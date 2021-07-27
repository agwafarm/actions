const core = require("@actions/core");
const dotenv = require("dotenv");
const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");

const {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const path = require("path");
const util = require("util");
const fs = require("fs");
const { ensureFile } = require("fs-extra");

const writeFile = util.promisify(fs.writeFile);

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const artifactsBucket = "agwa-ci-assets";
const companyName = "agwa";

const env = core.getInput("env");

if (!env) {
  throw new Error("Could not acquire env name");
}

core.setOutput("stack", env.replace("_", "-"));
const simpleEnv = env.replace("_", "").replace("-", "");

const region = core.getInput("awsRegion");

if (!region) {
  throw new Error("Could not acquire aws region");
}

const ssmClient = new SSMClient({ region });
const s3Client = new S3Client();

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function resolveServiceName(service) {
  return `${env}-${service}`;
}

async function downloadArtifactObject(key, folderName, fileName) {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: artifactsBucket,
      Key: key,
    })
  );

  const template = await streamToString(result.Body);
  const templatePath = path.join(process.cwd(), `${folderName}/${fileName}`);
  await ensureFile(templatePath);
  await writeFile(templatePath, template, "utf-8");
  return templatePath;
}

async function downloadCloudFormationTemplates(prefix, folderName) {
  const result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: artifactsBucket,
      Prefix: prefix,
    })
  );

  const stacks = result.Contents.map(async (o) => {
    const parts = o.Key.split("/");
    const fileName = parts[parts.length - 1];
    const stackName = fileName.replace(".yaml", "").replace(".yml", "");
    const localPath = await downloadArtifactObject(o.Key, folderName, fileName);
    console.log(
      `downloaded stack: ${stackName} from key ${o.Key} to file ${localPath}`
    );
    return { stackName, localPath };
  });

  return await Promise.all(stacks);
}

async function resolveService(parameter) {
  const serviceName = parameter.Name.replace(`/infra/rc-version/${env}/`, "");
  const version = parameter.Value;
  const rcPrefix = `${env}/${serviceName}/${version}`;
  const simpleRcPrefix = rcPrefix.replace(env, simpleEnv);
  console.log("downloading: ", templateUrlPrefix);
  const templateUrlPrefix = `${simpleRcPrefix}/cloudformation`;

  const cfnTemplates = await downloadCloudFormationTemplates(
    templateUrlPrefix,
    serviceName
  );

  const loadNestedStacks = cfnTemplates
    .filter((o) => o.stackName !== "main")
    .reduce((sum, item) => {
      sum[item.stackName] = { templateFile: item.localPath };
      return sum;
    }, {});

  return {
    name: resolveServiceName(serviceName),
    templatePath: cfnTemplates.find((o) => o.stackName == "main").localPath,
    loadNestedStacks,
    parameters: {
      Environment: simpleEnv,
      LambdaPrefix: `${simpleRcPrefix}/functions`,
      LayerPrefix: `${simpleRcPrefix}/layers`,
      TemplateUrlPrefix: `https://${artifactsBucket}.s3.amazonaws.com/${templateUrlPrefix}`,
      ArtifactsBucket: artifactsBucket,
      CompanyName: companyName,
      ServiceName: serviceName,
    },
  };
}

async function getParameters() {
  console.log(`fetching parameters for environment: ${env}`);
  const response = await ssmClient.send(
    new GetParametersByPathCommand({
      Path: `/infra/rc-version/${env}/`,
    })
  );

  console.log("parameters response acquired");
  console.log(response.Parameters);

  const services = await Promise.all(response.Parameters.map(resolveService));
  return { services };
}

async function run() {
  try {
    const parameters = await getParameters();
    console.log(JSON.stringify(parameters, null, 3));
    const { services } = parameters;
    core.setOutput("services", JSON.stringify(services));
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
