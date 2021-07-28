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

const artifactsBucket = "agwa-ci-assets";
const companyName = "agwa";

const s3Client = new S3Client();

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
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

  console.log("mapping prefix: ", prefix);
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

async function resolveService(env, serviceName, version) {
  const rcPrefix = `${serviceName}/${version}`;
  const templateUrlPrefix = `${rcPrefix}/cloudformation`;

  console.log("downloading: ", templateUrlPrefix, serviceName);
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
    name: serviceName,
    templatePath: cfnTemplates.find((o) => o.stackName == "main").localPath,
    loadNestedStacks,
    parameters: {
      Environment: env,
      LambdaPrefix: `${rcPrefix}/functions`,
      LayerPrefix: `${rcPrefix}/layers`,
      TemplateUrlPrefix: `https://${artifactsBucket}.s3.amazonaws.com/${templateUrlPrefix}`,
      ArtifactsBucket: artifactsBucket,
      CompanyName: companyName,
      ServiceName: serviceName,
    },
  };
}

module.exports = resolveService;
