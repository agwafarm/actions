const core = require("@actions/core");
const {
  SSMClient,
  PutParameterCommand,
  ParameterType,
} = require("@aws-sdk/client-ssm");

const region = core.getInput("awsRegion");

if (!region) {
  throw new Error("Could not acquire aws region");
}

const name = core.getInput("name");

if (!name) {
  throw new Error("Could not acquire param name");
}

const value = core.getInput("value");

if (!value) {
  throw new Error("Could not acquire param value");
}

const encrypted = core.getInput("encrypted");

if (!encrypted) {
  throw new Error("Could not acquire encrypted");
}

class ConfigurationService {
  constructor() {
    this.client = new SSMClient({ region });
  }

  setParameter = async (key, value) => {
    await this.client.send(
      new PutParameterCommand({
        Name: key,
        Value: value,
        Type:
          encrypted === "true"
            ? ParameterType.SECURE_STRING
            : ParameterType.STRING,
      })
    );
    console.log("parameter updated");
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();
    await configuration.setParameter(name, value);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
