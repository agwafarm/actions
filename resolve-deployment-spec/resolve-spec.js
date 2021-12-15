const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const { resolveBackendService, resolveFrontend } = require("./resolve-service");
const { resolveEnvVersion } = require("./resolve-version");

const ssmClient = new SSMClient({ region: "us-west-2" });
const ssmPrefix = `/infra/rc-version/`;

async function resolveServiceSpec(env, serviceName, version) {
  console.log("Resolving service spec");
  if (!version || version === "latest") {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: `${ssmPrefix}${serviceName}`,
      })
    );

    if (!response.Parameter) {
      throw new Error(
        `could not resolve latest version for service: ${serviceName}`
      );
    }

    version = response.Parameter.Value;
    console.log(
      `Resolved latest version of service ${serviceName} to ${version}`
    );
  }

  const serviceSpec = await resolveBackendService(env, serviceName, version);

  return { services: [serviceSpec], frontends: [] };
}

async function resolveEnvSpec(env, version) {
  console.log("Resolving version spec");
  version = resolveEnvVersion(version);

  const paramName = `/infra/version/${version}`;
  console.log(`resolving version ${version}. param name: ${paramName}`);
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: paramName,
    })
  );

  console.log(`resolved spec for version ${version}.`);

  const versionSpec = JSON.parse(response.Parameter.Value);
  console.log("Resolved version spec:");
  console.log(JSON.stringify(versionSpec, null, 3));

  const servicePromises = versionSpec.services.map((service) =>
    resolveBackendService(env, service.name, service.version)
  );

  const frontendPromises = versionSpec.frontends.map((frontend) =>
    resolveFrontend(env, frontend.name, frontend.version)
  );

  const services = await Promise.all(servicePromises);
  const frontends = await Promise.all(frontendPromises);

  return { services, frontends };
}

module.exports = { resolveEnvSpec, resolveServiceSpec };
