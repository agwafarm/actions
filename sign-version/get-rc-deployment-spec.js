// this file is duplicated in resolve-deployment-spec
const core = require("@actions/core");
const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({ region: "us-west-2" });
let overrides = core.getInput("overrides");

if (!overrides) {
  overrides = {};
} else {
  overrides = JSON.parse(overrides);
}

const github = require("@actions/github");
const author = github.context.actor;

function resolveVersion(name, version) {
  if (name === "cloud-parent") {
    return (
      overrides["cloud-parent"] || overrides["cloud-components"] || version
    );
  }

  if (name === "greengrass-parent") {
    return (
      overrides["greengrass-parent"] ||
      overrides["greengrass-service"] ||
      version
    );
  }

  return overrides[name] || version;
}

async function getRcServices() {
  const rcPath = "/infra/rc-version";
  console.log(`fetching rc pointers for services`);
  const response = await ssmClient.send(
    new GetParametersByPathCommand({
      Path: rcPath,
    })
  );

  const services = [];
  const frontends = [];

  if (!response.Parameters) {
    return services;
  }

  console.log(`Resolving service specifications`);

  for (const parameter of response.Parameters) {
    const serviceValue = JSON.parse(parameter.Value);
    const name = parameter.Name.replace(rcPath + "/", "");
    const version = resolveVersion(name, serviceValue.version);
    const spec = { name, version };

    if (serviceValue.type === "backend") {
      services.push(spec);
    } else {
      frontends.push(spec);
    }
  }

  // deploying this version would result in deletion of all existing services, probably a bug
  if (services.length === 0) {
    throw new Error("No services detected for version");
  }

  // deploying this version would result in deletion of all existing frontends, probably a bug
  if (frontends.length === 0) {
    throw new Error("No frontends detected for version");
  }

  return { services, frontends };
}

async function getRcDeploymentSpec(versionName) {
  const services = await getRcServices();
  const timestamp = Date.now();

  return {
    ...services,
    name: versionName,
    timestamp,
    author,
  };
}

module.exports = { getRcDeploymentSpec };
