const {
  SSMClient,
  GetParametersByPathCommand,
  GetParameterCommand,
} = require("@aws-sdk/client-ssm");

const resolveService = require("./resolve-service");

const ssmClient = new SSMClient({ region: "us-west-2" });
const ssmPrefix = `/infra/rc-version/`;

async function resolveServiceSpec({ env, serviceName, version, stackName }) {
  if (!version || version === "latest") {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Path: `${ssmPrefix}${serviceName}`,
      })
    );

    version = response.Value;
    console.log(
      `Resolved latest version of service ${serviceName} to ${version}`
    );
  }

  const serviceSpec = await resolveService({
    env,
    serviceName,
    version,
    stackName,
  });

  return { services: [serviceSpec] };
}

async function resolveEnvSpec(env) {
  const ssmPrefix = `/infra/rc-version/`;
  const response = await ssmClient.send(
    new GetParametersByPathCommand({
      Path: ssmPrefix,
    })
  );

  console.log("parameters response acquired");
  console.log(response.Parameters);

  const services = await Promise.all(
    response.Parameters.map((ssmParameter) => {
      const serviceName = ssmParameter.Name.replace(ssmPrefix, "");
      const version = ssmParameter.Value;
      return resolveService({ env, serviceName, version });
    })
  );
  return { services };
}

module.exports.resolveEnvSpec = resolveEnvSpec;
module.exports.resolveServiceSpec = resolveServiceSpec;
