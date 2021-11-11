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

async function downloadArtifactObject(key, targetFolder, fileName) {
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: artifactsBucket,
      Key: key,
    })
  );

  const template = await streamToString(result.Body);
  const templatePath = `${targetFolder}/${fileName}`;
  await ensureFile(templatePath);
  await writeFile(templatePath, template, "utf-8");
  // map to docker mounted volume where deploy-specification action will run
  return `/github/workspace/${templatePath}`;
}

async function downloadS3Prefix(prefix, targetFolder) {
  const result = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: artifactsBucket,
      Prefix: prefix,
    })
  );

  if (!result.Contents || result.Contents.length === 0) {
    console.log("no objects in s3 prefix: ", prefix);
    return null;
  }

  console.log("downloading s3 prefix: ", prefix);

  const objects = result.Contents.map(async (o) => {
    const parts = o.Key.split("/");
    const fileName = parts[parts.length - 1];
    const fileNameWithoutExtension = fileName.split(".")[0];
    const localPath = await downloadArtifactObject(
      o.Key,
      targetFolder,
      fileName
    );
    console.log(
      `downloaded object: ${fileNameWithoutExtension} from key ${o.Key} to file ${localPath}`
    );
    return { fileNameWithoutExtension, localPath };
  });

  return await Promise.all(objects);
}

async function downloadS3Prefixes(path, targetFolder, prefixes) {
  console.log(
    "downloading s3 objects for path: ",
    path,
    "target folder: ",
    targetFolder,
    "prefixes: ",
    prefixes
  );

  for (let prefix of prefixes) {
    const objects = await downloadS3Prefix(`${prefix}/${path}`, targetFolder);
    if (objects) {
      return { objects, prefix };
    }
  }

  throw new Error(
    `could not download any s3 objects for: ${path} for any of the prefixes: ${prefixes}`
  );
}

async function resolveSpec(env, serviceName, version) {
  // ordered specifically to favor standard storage retainment during deployment (if exists)
  // ensures temp versions are not deployed to non dev environments by some weird chance
  // low storage retainment is only used for dev environments
  const storagePrefixes = ["standard", "low"];
  let serviceS3Prefix = `${serviceName}/${version}`;
  let templateUrlPrefix = `${serviceS3Prefix}/cloudformation`;

  const { objects: cfnTemplates, prefix: cfnTemplatePrefix } =
    await downloadS3Prefixes(
      templateUrlPrefix,
      `specs/${serviceName}`,
      storagePrefixes
    );

  serviceS3Prefix = `${cfnTemplatePrefix}/${serviceS3Prefix}`;
  templateUrlPrefix = `${cfnTemplatePrefix}/${templateUrlPrefix}`;

  const loadNestedStacks = cfnTemplates
    .filter((o) => o.fileNameWithoutExtension !== "main")
    .reduce((result, item) => {
      result[item.fileNameWithoutExtension] = { templateFile: item.localPath };
      return result;
    }, {});

  const spec = {
    stackName: `${env}-${serviceName}`,
    templatePath: cfnTemplates.find((o) => o.fileNameWithoutExtension == "main")
      .localPath,
    loadNestedStacks,
    parameters: {
      Environment: env,
    },
  };

  return {
    spec,
    templateUrlPrefix,
    serviceS3Prefix,
    cfnTemplates,
    cfnTemplatePrefix,
  };
}

async function resolveBackendService(env, serviceName, version) {
  const { spec, serviceS3Prefix, templateUrlPrefix } = await resolveSpec(
    env,
    serviceName,
    version
  );
  const parameters = {
    LambdaPrefix: `${serviceS3Prefix}/functions`,
    LayerPrefix: `${serviceS3Prefix}/layers`,
    TemplateUrlPrefix: `https://${artifactsBucket}.s3.amazonaws.com/${templateUrlPrefix}`,
    ArtifactsBucket: artifactsBucket,
    CompanyName: companyName,
    ServiceName: serviceName,
  };

  spec.parameters = { ...spec.parameters, ...parameters };
  return spec;
}

async function resolveFrontend(env, serviceName, version) {
  const { spec } = await resolveSpec(env, serviceName, version);
  const parameters = {
    BucketName: `${env}-${companyName}-${serviceName}`,
    BucketPrefix: version,
    IndexPath: "index.html",
  };

  spec.parameters = { ...spec.parameters, ...parameters };
  return spec;
}

module.exports = { resolveBackendService, resolveFrontend };
