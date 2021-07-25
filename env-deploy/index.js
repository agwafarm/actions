const core = require("@actions/core");
const dotenv = require("dotenv");
const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const env = core.getInput("env");

if (!env) {
  throw new Error("Could not acquire env name");
}

const region = core.getInput("awsRegion");

if (!region) {
  throw new Error("Could not acquire aws region");
}

class ConfigurationService {
  constructor() {
    this.client = new SSMClient({ region });
  }

  getParameters = async () => {
    console.log(`fetching parameters for environment: ${env}`);
    const response = await this.client.send(
      new GetParametersByPathCommand({
        Path: `/infra/rc-version/${env}/`,
      })
    );

    console.log("parameter response acquired");
    console.log(response.Parameters);

    return response.Parameters?.map((parameter) => {
      return {
        service: parameter.Name.replace(`/infra/rc-version/${env}/`, ""),
        version: parameter.Value,
      };
    });
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();
    const services = await configuration.getParameters();
    core.setOutput("services", services);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
