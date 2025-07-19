import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

import { spawnSync } from "child_process";
import { EOL } from "os";

const ssmClient = new SSMClient({ region: "us-west-2" });
const mode = process.env["APP_MODE"] || "service";
const { env, version, frontends } = JSON.parse(
  process.env["APP_SPEC"] as string
);

async function updateEnvPointer() {
  if (mode !== "env" || version === "$ci") {
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

function syncForntendBuckets(sourcePrefix: string, targetBucket: string) {
  return new Promise((resolve, reject) => {
    // First, list the source files to see what's available
    const listArgs = [
      "s3",
      "ls",
      "--recursive",
      `s3://agwa-ci-assets/${sourcePrefix}`,
    ];

    console.log(`listing source files: aws ${listArgs.join(" ")}`);

    const listChild = spawnSync("aws", listArgs, {
      env: process.env,
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "ascii",
    });

    console.log(
      `source files in ${sourcePrefix}:${EOL}${listChild.stdout}${EOL}`
    );

    const syncArgs = [
      "s3",
      "sync",
      "--delete",
      "--no-progress",
      `s3://agwa-ci-assets/${sourcePrefix}`,
      `s3://${targetBucket}`,
    ];

    console.log(`syncing: ${sourcePrefix} with target bucket ${targetBucket}.`);
    console.log(`sync command: aws ${syncArgs.join(" ")}`);

    const child = spawnSync("aws", syncArgs, {
      env: process.env,
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "ascii",
    });

    console.log(`sync ${targetBucket} output:${EOL}${child.stdout}${EOL}`);

    if (child.stderr) {
      console.log(`sync ${targetBucket} stderr:${EOL}${child.stderr}${EOL}`);
    }

    // Force copy index.html specifically to ensure it's always updated
    const indexCopyArgs = [
      "s3",
      "cp",
      `s3://agwa-ci-assets/${sourcePrefix}/index.html`,
      `s3://${targetBucket}/index.html`,
      "--content-type",
      "text/html",
    ];

    console.log(`force copying index.html: aws ${indexCopyArgs.join(" ")}`);

    const indexChild = spawnSync("aws", indexCopyArgs, {
      env: process.env,
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "ascii",
    });

    console.log(`index.html copy output:${EOL}${indexChild.stdout}${EOL}`);

    if (indexChild.stderr) {
      console.log(`index.html copy stderr:${EOL}${indexChild.stderr}${EOL}`);
    }

    const failure = child.status || child.signal;
    const indexFailure = indexChild.status || indexChild.signal;

    if (failure) {
      console.log(
        `failed to sync source: ${sourcePrefix} with target bucket ${targetBucket}. reason: ${failure}`
      );
      reject(failure);
    } else if (indexFailure) {
      console.log(
        `failed to copy index.html from source: ${sourcePrefix} to target bucket ${targetBucket}. reason: ${indexFailure}`
      );
      reject(indexFailure);
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
    const syncBucketsPromise = syncForntendBuckets(
      sourcePrefix,
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
