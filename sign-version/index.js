const dotenv = require("dotenv");
dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const core = require("@actions/core");
const github = require("@actions/github");

const { getRcDeploymentSpec } = require("./get-rc-deployment-spec");
// const { updateCiVersion } = require("./update-ci-version");
// const { createVersion } = require("./create-version");

async function run() {
  try {
    let versionName = core.getInput("version", { required: true });

    const timestamp = Date.now();
    const datetime = new Date();

    const author = github.context.actor;

    if (versionName.length === 0) {
      throw new Error("Version length can not be empty");
    }

    console.log(`signing version: ${versionName}`);

    let spec;
    const versionSpec = core.getInput("versionSpec");
    if (versionSpec) {
      spec = JSON.parse(versionSpec);
    } else {
      spec = await getRcDeploymentSpec(versionName);
    }

    console.log("****Rc Deployment Spec", spec);
    // await createVersion({
    //   name: versionName,
    //   spec,
    //   timestamp,
    //   datetime,
    //   author,
    // });

    // if (!versionSpec) {
    //   await updateCiVersion(versionName);
    // }
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
