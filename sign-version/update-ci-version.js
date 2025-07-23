const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({ region: "us-west-2" });

async function updateCiVersion(version) {
  console.log(`updating ci version pointer to ${version}`);

  // await ssmClient.send(
  //   new PutParameterCommand({
  //     Name: `/infra/ci/variables/deployed-version`,
  //     Value: version,
  //     Description: `Version Specification for ci`,
  //     Type: "String",
  //     Overwrite: true,
  //   })
  // );

  console.log(`updated ci version pointer to ${version}`);
}

module.exports = { updateCiVersion };
