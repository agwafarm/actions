const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({ region: "us-west-2" });

const resolveEnvVersion = async (version) => {
  if (!version.startsWith("$")) {
    return version;
  }
  const env = version.replace("$", "");
  const paramName = `/infra/${env}/variables/deployed-version`;
  console.log(
    `resolving the version deployed to ${env}. param name: ${paramName}`
  );
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: paramName,
    })
  );

  if (!response.Parameter) {
    throw new Error(`could not resolve version for environment: ${env}`);
  }

  version = response.Parameter.Value;
  console.log(`Resolved version of env ${env} to ${version}`);
  return version;
};

module.exports = { resolveEnvVersion };
