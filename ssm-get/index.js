const core = require("@actions/core");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const region = core.getInput("awsRegion");

if (!region) {
  throw new Error("Could not acquire aws region");
}

const name = core.getInput("name");

if (!name) {
  throw new Error("Could not acquire param name");
}

const encrypted = core.getInput("encrypted");

if (!encrypted) {
  throw new Error("Could not acquire encrypted");
}

class ConfigurationService {
  constructor() {
    this.client = new SSMClient({ region });
  }

  getParameter = async (key) => {
    const response = await this.client.send(
      new GetParameterCommand({
        Name: key,
        WithDecryption: encrypted === "true",
      })
    );
    console.log("parameter response acquired");
    const value = response.Parameter && response.Parameter.Value;
    if (!value) {
      throw new Error(`could not obtain parameter: ${key}`);
    }
    console.log("returning parameter");
    return value;
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();
    const value = await configuration.getParameter(name);
    if (encrypted !== "true") {
      console.log("got value", value);
    }
    core.setOutput("value", value);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
