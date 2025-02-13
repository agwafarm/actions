// this file is duplicated in resolve-deployment-spec except for the gg2_components
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
  const components = await fetchAllComponents();

  const prodComponents = filterComponentsByPrefix(components, "prod");
  const testComponents = filterComponentsByPrefix(components, "test");

  const prodComponentMap = mapComponentsByName(prodComponents, "prod_");
  const testComponentMap = mapComponentsByName(testComponents, "test_");

  return compareAndBuildComponentList(prodComponentMap, testComponentMap);
}

async function fetchAllComponents() {
  const components = [];
  let command = new ListComponentsCommand();
  let response;

  do {
    response = await gg_client.send(command);
    components.push(...response.components);
    command.input.nextToken = response.nextToken;
  } while (response.nextToken);

  return components;
}

function filterComponentsByPrefix(components, prefix) {
  return components.filter((component) =>
    component.componentName.startsWith(prefix)
  );
}

function mapComponentsByName(components, prefix) {
  return components.reduce((map, component) => {
    const name = component.componentName.replace(prefix, "");
    map[name] = component;
    return map;
  }, {});
}

function compareAndBuildComponentList(prodComponentMap, testComponentMap) {
  const gg2_components = [];

  for (const name in prodComponentMap) {
    if (!testComponentMap[name]) {
      throw new Error(`Component ${name} not found in test environment`);
    }

    const prodVersion = prodComponentMap[name].latestVersion.componentVersion;
    const testVersion = testComponentMap[name].latestVersion.componentVersion;

    if (prodVersion !== testVersion) {
      throw new Error(
        `Component ${name} version mismatch: prod=${prodVersion}, test=${testVersion}`
      );
    }

    gg2_components.push({ name, version: prodVersion });
  }

  return gg2_components;
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
