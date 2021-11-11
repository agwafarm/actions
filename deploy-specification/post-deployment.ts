import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

import { spawn } from "child_process";

console.log("running post-deployment script");

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

function syncBuckets(sourcePrefix: string, targetBucket: string) {
  return new Promise((resolve, reject) => {
    const syncArgs = [
      "s3",
      "sync",
      "--delete",
      `s3://agwa-ci-assets/${sourcePrefix}`,
      `s3://${targetBucket}`,
    ];

    const child = spawn("aws", syncArgs, { env: process.env });
    child.on("exit", function (code, signal) {
      if (code || signal) {
        console.log(
          `failed to sync source: ${sourcePrefix} with target bucket ${targetBucket}`
        );
        reject(code || signal);
      } else {
        resolve("");
      }
    });
  });
}

async function updateS3Artifacts() {
  const promises: Promise<any>[] = [];
  for (const frontend of frontends) {
    const frontendBucket = frontend.parameters.BucketName;
    const sourcePrefix = `${frontend.name}/${frontend.version}/web/${env}`;
    const syncBucketsPromise = syncBuckets(sourcePrefix, frontendBucket);

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
