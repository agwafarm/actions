const core = require("@actions/core");
const dotenv = require("dotenv");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const appBackend = process.env["APP_BACKEND"];
const app = process.env["APP_NAME"];

if (!appBackend) {
  throw new Error("Could not acquire app backend name");
}

if (!app) {
  throw new Error("Could not acquire app name");
}

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

  getParameter = async (key) => {
    console.log(`fetching parameter: ${key} for environment: ${env}`);
    const response = await this.client.send(
      new GetParameterCommand({
        Name: `/infra/${env}/${key}`,
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
    const userPoolId = await configuration.getParameter(
      `auth/cognito/user-pool/id/${appBackend}`
    );
    console.log("user pool id", userPoolId);

    const clientAppId = await configuration.getParameter(
      `auth/cognito/user-pool/client/id/${appBackend}`
    );

    console.log("client app id", clientAppId);

    const identityPoolId = await configuration.getParameter(
      `auth/cognito/identity-pool/id/${appBackend}`
    );

    console.log("identity pool id", identityPoolId);

    const httpApiUrl = await configuration.getParameter(
      `backend/rest/url/${appBackend}`
    );

    console.log("rest api url", httpApiUrl);

    const frontendUrl = await configuration.getParameter(`frontend/url/${app}`);
    console.log("frontend url", frontendUrl);

    core.setOutput("userPoolId", userPoolId);
    core.setOutput("clientAppId", clientAppId);
    core.setOutput("identityPoolId", identityPoolId);
    core.setOutput("restApiUrl", httpApiUrl);
    core.setOutput("frontendUrl", frontendUrl);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
