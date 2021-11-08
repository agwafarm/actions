const core = require("@actions/core");
const dotenv = require("dotenv");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const { resolveEnvSpec, resolveServiceSpec } = require("./resolve-spec");

const environment = core
  .getInput("environment")
  .replace("_", "")
  .replace("-", "")
  .toLowerCase();

const serviceName = core.getInput("service");
const version = core.getInput("version");

console.log(
  `inputs: ${JSON.stringify(
    { env: environment, serviceName, version },
    null,
    3
  )}`
);

async function run() {
  try {
    if (!serviceName && !version) {
      throw new Error("either service or version must be specified");
    }

    if (!environment) {
      throw new Error("Could not acquire env name");
    }

    const spec = await (serviceName
      ? resolveServiceSpec(environment, serviceName, version)
      : resolveEnvSpec(environment, version));

    core.setOutput("spec", JSON.stringify(spec));
    console.log(JSON.stringify(spec, null, 3));
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
