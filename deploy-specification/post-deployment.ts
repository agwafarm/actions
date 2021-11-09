import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

console.log("running env-deployment script");

const mode = process.env["APP_MODE"] || "service";
const { env, version } = JSON.parse(process.env["APP_SPEC"] as string);
const ssmClient = new SSMClient({ region: "us-west-2" });

if (mode === "env") {
  console.log(`updating environment ${env} version pointer to ${version}`);
  ssmClient
    .send(
      new PutParameterCommand({
        Name: `/infra/${env}/variables/deployed-version`,
        Value: version,
        Description: `Deployed version for the ${env} environment`,
        Type: "String",
      })
    )
    .then(() => {
      console.log(`updated environment ${env} version pointer to ${version}`);
      process.exit(0);
    })
    .catch((e) => {
      console.log(
        `failed to update environment ${env} version pointer to ${version}`
      );
      console.log(e);
      process.exit(1);
    });
}
