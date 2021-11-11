import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";
import {
  S3Client,
  CopyObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

console.log("running post-deployment script");

const s3Client = new S3Client({});
const ssmClient = new SSMClient({ region: "us-west-2" });
const mode = process.env["APP_MODE"] || "service";
const { env, version, frontends } = JSON.parse(
  process.env["APP_SPEC"] as string
);

async function updateEnvPointer() {
  if (mode !== "env") {
    return;
  }
  console.log(`updating environment ${env} version pointer to ${version}`);

  await ssmClient.send(
    new PutParameterCommand({
      Name: `/infra/${env}/variables/deployed-version`,
      Value: version,
      Description: `Deployed version for the ${env} environment`,
      Type: "String",
    })
  );
}

async function syncBuckets(
  sourcePrefix: string,
  targetPrefix: string,
  targetBucket: string
) {
  const objectsInPrefix = await s3Client.send(
    new ListObjectsV2Command({ Bucket: "agwa-ci-assets", Prefix: sourcePrefix })
  );

  if (!objectsInPrefix.Contents || objectsInPrefix.Contents.length === 0) {
    console.log("no objects in s3 prefix in agwa-ci-bucket: ", sourcePrefix);
    throw new Error(
      "no objects in s3 prefix in agwa-ci-bucket: " + sourcePrefix
    );
  }

  const objects = objectsInPrefix.Contents.map((o) => {
    return s3Client.send(
      new CopyObjectCommand({
        Bucket: targetBucket,
        Key: targetPrefix + (o.Key as string).replace(sourcePrefix, ""),
        CopySource: `s3://agwa-ci-assets/${o.Key}`,
      })
    );
  });

  return await Promise.all(objects);
}

async function updateS3Artifacts() {
  const promises: Promise<any>[] = [];
  for (const frontend of frontends) {
    const frontendBucket = frontend.parameters.Bucket;
    const frontendPrefix = frontend.parameters.BucketPrefix;
    const sourcePrefix = `${frontend.name}/${frontendPrefix}/web`;
    const copyIndexPromise = s3Client.send(
      new CopyObjectCommand({
        Bucket: frontendBucket,
        Key: `${frontendPrefix}.html`,
        CopySource: `s3://agwa-ci-assets/${sourcePrefix}/index.html`,
      })
    );
    promises.push(copyIndexPromise);

    const syncBucketsPromise = syncBuckets(
      sourcePrefix,
      frontendPrefix,
      frontendBucket
    );
    promises.push(syncBucketsPromise);
  }

  await Promise.all(promises);
}

async function run() {
  try {
    await updateS3Artifacts();

    // should always be last!
    await updateEnvPointer();
  } catch (e) {
    console.log("failed to execute post-deployment script");
    console.log(e);
    process.exit(1);
  }
}

run();
