const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const resolveService = require("./resolve-service");

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

    version = response.Parameter.Value;
    console.log(
      `Resolved latest version of service ${serviceName} to ${version}`
    );
  }

  const serviceSpec = await resolveService(env, serviceName, version);

  return { services: [serviceSpec] };
}

async function resolveEnvSpec(env, version) {
  console.log("Resolving version spec");

  const paramName = `/infra/version/${version}`;
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: paramName,
    })
  );

  if (!response.Parameter) {
    throw new Error(`no such parameter: ${paramName}`);
  }

  const versionSpec = JSON.parse(response.Parameter.Value);
  console.log("Resolved version spec:");
  console.log(JSON.stringify(versionSpec, null, 3));

  const servicePromises = versionSpec.services.map((service) =>
    resolveService(env, service.name, service.version)
  );

  const services = await Promise.all(...servicePromises);

  return { services };
}

module.exports.resolveEnvSpec = resolveEnvSpec;
module.exports.resolveServiceSpec = resolveServiceSpec;
