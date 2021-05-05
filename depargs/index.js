const core = require("@actions/core");
const github = require("@actions/github");
const dotenv = require("dotenv");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const app = process.env["APP_NAME"];

if (!app) {
   throw new Error("Could not acquire app name");
}

const region = core.getInput("awsRegion");

if (!region) {
   throw new Error("Could not acquire aws region");
}

function decideForWorkflowDispatch() {
   const shouldDeploy = github.context.payload.inputs.deploy === "true";
   if (!shouldDeploy) {
      console.log("dry run, skipping deployment");
   }
   const env = github.context.payload.inputs.env;
   if (!env) {
      console.log("target env not specified, skipping deployment");
   }
   deploy = shouldDeploy && !!env;
   const libraryTag = github.context.payload.inputs.libraryTag;
   if (!libraryTag) {
      throw new Error("no library tag specified in workflow dispatch");
   }
   return { env, deploy, libraryTag };
}

function decideForPush() {
   const branchName = github.context.ref;
   console.log(`branch name: ${branchName}`);
   let libraryTag = "latest";
   if (branchName == "refs/heads/master" || branchName == "refs/heads/main") {
      env = "test";
   } else {
      env = "dev";
      libraryTag = "edge";
   }

   return { env, deploy: true, libraryTag };
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

      const libraryTag = decision.libraryTag;
      console.log("using library tag: ", libraryTag);

      const env = decision.env;
      const isLocal = !!process.env.ACT;
      const deploy = !isLocal && decision.deploy;
      if (deploy) {
         console.log(`will deploy to environment: ${env}`);
      } else {
         console.log("will not deploy");
      }
      const corsOrigin = "*";
      console.log("Allowed CORS origins: ", corsOrigin);
      const corsHeaders =
         "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Accept,User-Agent,Referer";
      console.log("Allowed CORS headers: ", corsHeaders);
      const corsMethods = "OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD";
      console.log("Allowed CORS methods: ", corsMethods);

      core.setOutput("corsOrigin", corsOrigin);
      core.setOutput("corsHeaders", corsHeaders);
      core.setOutput("corsMethods", corsMethods);
      core.setOutput("env", env);
      core.setOutput("stacks", `${env}-${app}-service ${env}-${app}-resources`);
      core.setOutput("deploy", deploy);
      core.setOutput("libraryTag", libraryTag);
   } catch (error) {
      console.log(error);
      core.setFailed(error.message);
   }
}

run();
