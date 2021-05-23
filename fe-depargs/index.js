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

function decideForWorkflowDispatch() {
  const shouldDeploy = github.context.payload.inputs.deploy === "true";
  if (!shouldDeploy) {
    console.log("dry run, skipping deployment");
  }
  const env = github.context.payload.inputs.env;
  if (!env) {
    throw new Error("target env not specified in workflow_dispatch");
  }
  deploy = shouldDeploy && !!env;
  return { env, deploy };
}

function decideForPush() {
  const branchName = github.context.ref;
  console.log(`branch name: ${branchName}`);
  if (branchName == "refs/heads/master" || branchName == "refs/heads/main") {
    env = "test";
  } else {
    env = "dev";
  }

  return { env, deploy: true };
}

const eventNameToDecision = {
  workflow_dispatch: decideForWorkflowDispatch,
  push: decideForPush,
};

async function run() {
  try {
    console.log(`handling github event: ${github.context.eventName}`);
    const decisionFunction = eventNameToDecision[github.context.eventName];

    if (!decisionFunction) {
      throw new Error(
        `unsupported github event type: ${github.context.eventName} fix your YAML or add a decision function in depargs action`
      );
    }

    const decision = decisionFunction();
    const env = decision.env;
    const isLocal = !!process.env.ACT;
    const deploy = !isLocal && decision.deploy;
    if (deploy) {
      console.log(`will deploy to environment: ${env}`);
    } else {
      console.log("will not deploy");
    }

    const bucketName = `${env}-${companyName}-${app}-web`;
    console.log("bucket name", bucketName);

    core.setOutput("env", env);
    core.setOutput("stacks", `${env}-${app}-web`);
    core.setOutput("deploy", deploy);
    core.setOutput("bucketName", bucketName);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
