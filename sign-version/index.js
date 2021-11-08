const core = require("@actions/core");
const dotenv = require("dotenv");
const github = require("@actions/github");

const {
  SSMClient,
  GetParametersByPathCommand,
  PutParameterCommand,
} = require("@aws-sdk/client-ssm");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const versionName = core.getInput("versionName", { required: true });
const region = core.getInput("awsRegion", { required: true });

const timestamp = Date.now();
const author = github.context.actor;

console.log(`creating version: ${versionName}`);
class ConfigurationService {
  constructor() {
    this.client = new SSMClient({ region });
  }

  getRcServices = async () => {
    const rcPath = "/infra/rc-version";
    console.log(`fetching rc pointers for services`);
    const response = await this.client.send(
      new GetParametersByPathCommand({
        Path: rcPath,
      })
    );

    console.log(`parameter response acquired: ${response.Parameters}`);

    const services = [];

    if (!response.Parameters) {
      return services;
    }

    console.log(`Resolving service specifications`);

    for (const parameter of response.Parameters) {
      const version = parameter.Value;
      const service = parameter.Name.replace(rcPath + "/", "");
      const serviceSpec = { service, version };
      console.log(JSON.stringify(serviceSpec, null, 3));
      services.push(serviceSpec);
    }

    return services;
  };

  createVersion = async (versionName, spec) => {
    const versionPath = `/infra/version/${versionName}`;
    console.log(`creating version ${versionName} with spec:`);
    console.log(JSON.stringify(spec, null, 3));
    await this.client.send(
      new PutParameterCommand({
        Path: versionPath,
        Value: JSON.stringify(spec),
        Description: `Version Specification for ${versionName}`,
        Type: "String",
        Tags: [
          { Key: "author", Value: author },
          { Key: "timestamp", Value: `${timestamp}` },
          { Key: "name", Value: versionName },
        ],
      })
    );

    console.log(`version spec created`);
  };
}

async function run() {
  try {
    if (versionName.length === 0) {
      throw new Error("Version length can not be empty");
    }

    const configuration = new ConfigurationService();
    const services = await configuration.getRcServices();

    if (services.length === 0) {
      throw new Error("No services detected");
    }

    const spec = {
      name: versionName,
      services,
      timestamp,
      author,
    };
    await configuration.createVersion(versionName, spec);
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
