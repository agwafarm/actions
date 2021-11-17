import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

import { spawnSync } from "child_process";

const ssmClient = new SSMClient({ region: "us-west-2" });
const mode = process.env["APP_MODE"] || "service";
const { env, version, frontends } = JSON.parse(
  process.env["APP_SPEC"] as string
);

console.log(`running post-deployment script for version: ${version}`);

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
      Overwrite: true,
    })
  );
}

function syncBuckets(sourcePrefix: string, targetBucket: string) {
  return new Promise((resolve, reject) => {
    const syncArgs = [
      "s3",
      "sync",
      "--delete",
      "--no-progress",
      `s3://agwa-ci-assets/${sourcePrefix}`,
      `s3://${targetBucket}`,
    ];

    console.log(`syncing: ${sourcePrefix} with target bucket ${targetBucket}.`);

    const child = spawnSync("aws", syncArgs, {
      env: process.env,
      cwd: process.cwd(),
    });

    console.log(child.stdout);

    const failure = child.status || child.signal;
    if (failure) {
      console.log(
        `failed to sync source: ${sourcePrefix} with target bucket ${targetBucket}. reason: ${failure}`
      );

      reject(failure);
    } else {
      console.log(
        `successfully synced source: ${sourcePrefix} with target bucket: ${targetBucket}`
      );
      resolve(undefined);
    }
  });
}

async function updateS3Artifacts() {
  if (mode !== "env") {
    return;
  }

  console.log(`syncing s3 buckets for environment ${env}`);

  const promises: Promise<any>[] = [];

  for (const frontend of frontends) {
    const frontendBucket = frontend.parameters.BucketName;
    const sourcePrefix = `standard/${frontend.serviceName}/${frontend.version}/web/${env}`;
    const syncBucketsPromise = syncBuckets(sourcePrefix, frontendBucket);

    promises.push(syncBucketsPromise);
  }

  console.log(`waiting for all sync commands to finish`);
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
