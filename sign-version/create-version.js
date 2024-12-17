const {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({ region: "us-west-2" });

async function createVersion({
  name,
  spec,
  timestamp,
  datetime,
  author,
}) {
  const versionPath = `/infra/version/${name}`;

  try {
    const existingVersion = await ssmClient.send(
      new GetParameterCommand({ Name: versionPath })
    );
    if (existingVersion.Parameter) {
      throw new Error(`version ${name} already exists`);
    }
  } catch (e) {
    // ParameterNotFound thrown -> version does not exist yet -> continue
    if (e.name !== "ParameterNotFound") {
      throw e;
    }
  }

  console.log(`creating version ${name} in path: ${versionPath} with spec:`);
  console.log(JSON.stringify(spec, null, 3));

  await ssmClient.send(
    new PutParameterCommand({
      Name: versionPath,
      Value: JSON.stringify(spec),
      Description: `Version Specification for ${name}`,
      Type: "String",
      Tags: [
        { Key: "author", Value: `${author}` },
        { Key: "timestamp", Value: `${timestamp}` },
        { Key: "datetime", Value: `${datetime.toISOString()}` },
        { Key: "versionName", Value: `${name}` },
      ],
    })
  );

  console.log(`version spec created`);
}

module.exports = { createVersion };
