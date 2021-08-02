const {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

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
  const templatePath = `${folderName}/${fileName}`;
  await ensureFile(templatePath);
  await writeFile(templatePath, template, "utf-8");
  // map to docker mounted volume where deploy-specification action will run
  return `/github/workspace/${templatePath}`;
}

async function downloadS3Prefix(prefix, folderName) {
  const result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: artifactsBucket,
      Prefix: prefix,
    })
  );

  console.log("mapping prefix: ", artifactsBucket, iprefix);
  const stacks = result.Contents.map(async (o) => {
    const parts = o.Key.split("/");
    const fileName = parts[parts.length - 1];
    const fileNameNoPrefix = fileName.split(".")[0];
    const localPath = await downloadArtifactObject(o.Key, folderName, fileName);
    console.log(
      `downloaded object: ${fileNameNoPrefix} from key ${o.Key} to file ${localPath}`
    );
    return { fileNameNoPrefix, localPath };
  });

  return await Promise.all(stacks);
}

async function resolveService(env, serviceName, version, stackName) {
  const retainmentPrefix = env.startsWith("dev") ? "low" : "standard";
  const serviceS3Prefix = `${retainmentPrefix}/${serviceName}/${version}`;
  const templateUrlPrefix = `${serviceS3Prefix}/cloudformation`;

  console.log("downloading: ", templateUrlPrefix, serviceName);
  const cfnTemplates = await downloadS3Prefix(
    templateUrlPrefix,
    `specs/${serviceName}`
  );

  const loadNestedStacks = cfnTemplates
    .filter((o) => o.fileNameNoPrefix !== "main")
    .reduce((sum, item) => {
      sum[item.fileNameNoPrefix] = { templateFile: item.localPath };
      return sum;
    }, {});

  return {
    stackName: `${env}-${stackName}`,
    templatePath: cfnTemplates.find((o) => o.fileNameNoPrefix == "main")
      .localPath,
    loadNestedStacks,
    parameters: {
      Environment: env,
      LambdaPrefix: `${serviceS3Prefix}/functions`,
      LayerPrefix: `${serviceS3Prefix}/layers`,
      TemplateUrlPrefix: `https://${artifactsBucket}.s3.amazonaws.com/${templateUrlPrefix}`,
      ArtifactsBucket: artifactsBucket,
      CompanyName: companyName,
      ServiceName: serviceName,
    },
  };
}

module.exports = resolveService;
