// this file is duplicated in resolve-deployment-spec
const core = require("@actions/core");
const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");
const {
  GreengrassV2Client,
  ListComponentsCommand,
} = require("@aws-sdk/client-greengrassv2");
const ssmClient = new SSMClient({ region: "us-west-2" });
const gg_client = new GreengrassV2Client({ region: "us-west-2" });
const github = require("@actions/github");
const author = github.context.actor;

function resolveVersion(name, version) {
  return version;
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

async function getRcGG2Components() {
  const components = [];
  const command = new ListComponentsCommand();
  const response = await gg_client.send(command);
  components.push(...response.components);
  while (response.nextToken) {
    command.input.nextToken = response.nextToken;
    response = await gg_client.send(command);
    components.push(...response.components);
  }

  if (components.length === 0) {
    throw new Error("No GreengrassV2 components detected");
  }

  const prodComponents = components.filter((component) =>
    component.name.startsWith("prod")
  );

  const testComponents = components.filter((component) =>
    component.name.startsWith("test")
  );

  const prodComponentMap = {};
  const testComponentMap = {};

  for (const component of prodComponents) {
    const name = component.name.replace("prod_", "");
    prodComponentMap[name] = component;
  }

  for (const component of testComponents) {
    const name = component.name.replace("test_", "");
    testComponentMap[name] = component;
  }

  const gg2_components = [];
  for (const name in prodComponentMap) {
    if (!testComponentMap[name]) {
      throw new Error(`Component ${name} not found in test environment`);
    }

    const prodVersion = prodComponentMap[name].latestVersion;
    const testVersion = testComponentMap[name].latestVersion;

    if (prodVersion !== testVersion) {
      throw new Error(
        `Component ${name} version mismatch: prod=${prodVersion}, test=${testVersion}`
      );
    }

    gg2_components.push({ name, version: prodVersion });
  }
}

async function getRcDeploymentSpec(versionName) {
  const services = await getRcServices();
  const gg2_components = await getRcGG2Components();
  const timestamp = Date.now();

  return {
    ...services,
    gg2_components,
    name: versionName,
    timestamp,
    author,
  };
}

module.exports = { getRcDeploymentSpec };
