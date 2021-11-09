const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");

console.log("running env-deployment script");

const mode = process.env["APP_MODE"] || "service";
const { env, version } = JSON.parse(process.env["APP_SPEC"]);
const ssmClient = new SSMClient({ region: "us-west-2" });

if (mode === "env") {
  await ssmClient.send(
    new PutParameterCommand({
      Name: `/infra/${env}/variables/deployed-version`,
      Value: version,
      Description: `Deployed version for the ${env} environment`,
      Type: "String",
    })
  );
}
