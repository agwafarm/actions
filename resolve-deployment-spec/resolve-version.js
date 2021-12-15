const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({ region: "us-west-2" });

export const resolveEnvVersion = async (version) => {
  if (!version.startsWith("$")) {
    return version;
  }
  const env = version.replace("$", "");
  console.log(`resolving the version deployed to ${env}`);
  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: `/infra/${env}/variables/deployed-version`,
    })
  );

  if (!response.Parameter) {
    throw new Error(`could not resolve version for environment: ${env}`);
  }

  version = response.Parameter.Value;
  console.log(`Resolved version of env ${env} to ${version}`);
  return version;
};
