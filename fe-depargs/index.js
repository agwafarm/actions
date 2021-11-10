const core = require("@actions/core");
const github = require("@actions/github");
const dotenv = require("dotenv");

dotenv.config({ path: ".config" });

const app = process.env["APP_NAME"];

if (!app) {
  throw new Error(`required env variable APP_NAME is not present`);
}

const companyName = core.getInput("companyName");

if (!companyName) {
  throw new Error(`missing companyName input`);
}

function computeEnv() {
  const branchName = github.context.ref;
  console.log(`branch name: ${branchName}`);

  if (branchName == "refs/heads/master" || branchName == "refs/heads/main") {
    return "ci";
  }

  return "dev" + github.context.actor.replace(/\W/g, "").toLowerCase();
}

async function run() {
  try {
    console.log(`handling github event: ${github.context.eventName}`);

    const env = computeEnv();
    const bucketPrefix = github.context.sha;
    const bucketName = `${env}-${companyName}-${app}-web`;

    console.log(`will deploy to environment: ${env}`);
    console.log("bucket name", bucketName);
    console.log("bucket prefix", bucketPrefix);

    core.setOutput("bucketName", bucketName);
    core.setOutput("env", env);
    core.setOutput("stacks", `${env}-${app}-web`);
    core.setOutput("bucketPrefix", bucketPrefix);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
