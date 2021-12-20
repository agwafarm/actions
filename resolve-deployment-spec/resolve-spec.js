const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const { resolveBackendService, resolveFrontend } = require("./resolve-service");
const { resolveEnvVersion } = require("./resolve-version");
const { getRcDeploymentSpec } = require("./get-rc-deployment-spec");

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

  return { services: [serviceSpec], frontends: [], version, env };
}

async function resolveDeploymentSpec(env, version, versionSpec) {
  console.log("Resolving deployment spec:");
  console.log(JSON.stringify(versionSpec, null, 3));

  const servicePromises = versionSpec.services.map((service) =>
    resolveBackendService(env, service.name, service.version)
  );

  const frontendPromises = versionSpec.frontends.map((frontend) =>
    resolveFrontend(env, frontend.name, frontend.version)
  );

  const services = await Promise.all(servicePromises);
  const frontends = await Promise.all(frontendPromises);

  return { services, frontends, version, env };
}

async function resolveSignedVersion(env, version) {
  console.log("Resolving signed version spec");
  version = await resolveEnvVersion(version);

  const paramName = `/infra/version/${version}`;
  console.log(`resolving version ${version}. param name: ${paramName}`);
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: paramName,
    })
  );

  console.log(`resolved spec for version ${version}.`);

  const versionSpec = JSON.parse(response.Parameter.Value);
  return resolveDeploymentSpec(env, version, versionSpec);
}

async function resolveCiVersion(env) {
  const versionSpec = await getRcDeploymentSpec();
  return resolveDeploymentSpec(env, "$ci", versionSpec);
}

async function resolveEnvSpec(env, version) {
  if (version === "$ci") {
    if (!env.startsWith("dev"))
      /**
       * there is no Signed version of the CI environment in SSM.
       * Which means the deployed version ssm param would have no value.
       * Which would break the flow of deploying $test to prod.
       * This means we do should not enable deployment to test / prod / actual environments.
       *
       */
      throw new Error(
        `Deploying $ci is only supported for development environments. Use a signed version instead.`
      );

    return resolveCiVersion(env);
  }

  return resolveSignedVersion(env, version);
}

module.exports = { resolveEnvSpec, resolveServiceSpec };
