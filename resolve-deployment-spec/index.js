const core = require("@actions/core");
const dotenv = require("dotenv");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const { resolveEnvSpec, resolveServiceSpec } = require("./resolve-spec");

const env = core.getInput("environment").replace("_", "").replace("-", "");
const service = core.getInput("service");
const version = core.getInput("version");

if (!env) {
  throw new Error("Could not acquire env name");
}

console.log("env: ", env);

async function run() {
  try {
    const spec = await (service
      ? resolveServiceSpec(env, service, version)
      : resolveEnvSpec(env));

    core.setOutput("spec", JSON.stringify(spec));
    console.log("spec:", JSON.stringify(spec, null, 3));

    const { services } = spec;

    const stacks = services.map((service) => service.name).join(" ");

    console.log("stacks:", JSON.stringify(stacks, null, 3));
    core.setOutput("stacks", stacks);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
