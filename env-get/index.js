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
const fs = require("fs");
const util = require("util");
const path = require("path");

const writeFile = util.promisify(fs.writeFile);
dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const artifactsBucket = "agwa-ci-assets";

const env = core.getInput("env");

if (!env) {
  throw new Error("Could not acquire env name");
}

const region = core.getInput("awsRegion");

if (!region) {
  throw new Error("Could not acquire aws region");
}

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

// stacks and service name behavior is related, this function emphasizes the relationship
function resolveServiceName(service) {
  return `${env}-${service}`;
}

async function downloadArtifactObject(key, folderName, fileName) {
  const result = await this.s3Client.send(
    new GetObjectCommand({
      Bucket: artifactsBucket,
      Key: key,
    })
  );

  const template = streamToString(result.Body);
  console.log("template", template);
  const templatePath = `${folderName}/${fileName}.yaml`;
  await writeFile(templatePath, template, "utf-8");
  return path.join(process.cwd(), templatePath);
}

async function downloadCloudFormationTemplates(prefix, folderName) {
  const result = await this.s3Client.send(
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
  const templateUrlPrefix = `${rcPrefix}/cloudformation`;

  const cfnTemplates = await downloadCloudFormationTemplates(
    rcPrefix,
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
      Environment: env,
      LambdaPrefix: rcPrefix,
      TemplateUrlPrefix: `https://s3.amazonaws.com/${artifactsBucket}/${templateUrlPrefix}`,
      ArtifactsBucket: aritfactsBucket,
      CompanyName: process.env["COMPANY_NAME"],
    },
  };
}

class ConfigurationService {
  constructor() {
    this.ssmClient = new SSMClient({ region });
    this.s3Client = new S3Client();
  }

  getParameters = async () => {
    console.log(`fetching parameters for environment: ${env}`);
    const response = await this.ssmClient.send(
      new GetParametersByPathCommand({
        Path: `/infra/rc-version/${env}/`,
      })
    );

    console.log("parameters response acquired");
    console.log(response.Parameters);

    const values = response.Parameters.map(resolveService);
    const services = await Promise.all(values);
    const stacks = services.map(resolveServiceName);
    return { services, stacks };
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();
    const { services, stacks } = await configuration.getParameters();
    core.setOutput("services", JSON.stringify(services));
    core.setOutput("stacks", stacks.join(" "));
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
