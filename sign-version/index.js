const core = require("@actions/core");
const dotenv = require("dotenv");
const github = require("@actions/github");

const {
  SSMClient,
  GetParameterCommand,
  GetParametersByPathCommand,
  PutParameterCommand,
} = require("@aws-sdk/client-ssm");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const ssmClient = new SSMClient({ region });

let versionName = core.getInput("version", { required: true });
const hotfix = core.getInput("hotfix");
if (hotfix) {
  versionName = `${versionName}-hotfix-${hotfix}`;
}

const region = core.getInput("awsRegion", { required: true });
let overrides = core.getInput("overrides");

if (!overrides) {
  overrides = {};
} else {
  overrides = JSON.parse(overrides);
}

const timestamp = Date.now();
const author = github.context.actor;

function resolveVersion(name, version) {
  if (name === "cloud-parent") {
    return (
      overrides["cloud-parent"] || overrides["cloud-components"] || version
    );
  }

  return overrides[name] || version;
}

async function getRcServices() {
  const rcPath = "/infra/rc-version";
  console.log(`fetching rc pointers for services`);
  const response = await ssmClient.send(
    new GetParametersByPathCommand({
      Path: rcPath,
    })
  );

  console.log(`get parameters by path response acquired`);

  const services = [];

  if (!response.Parameters) {
    return services;
  }

  console.log(`Resolving service specifications`);

  for (const parameter of response.Parameters) {
    const name = parameter.Name.replace(rcPath + "/", "");
    const version = resolveVersion(name, parameter.Value);
    const serviceSpec = { name, version };
    console.log(JSON.stringify(serviceSpec, null, 3));
    services.push(serviceSpec);
  }

  return services;
}

async function createVersion({ name, spec, timestamp, author }) {
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
        { Key: "versionName", Value: `${name}` },
      ],
    })
  );

  console.log(`version spec created`);
}

async function run() {
  try {
    if (versionName.length === 0) {
      throw new Error("Version length can not be empty");
    }

    console.log(`signing version: ${versionName}`);
    console.log(`overrides: ${JSON.stringify(overrides, null, 3)}`);

    const services = await getRcServices();

    if (services.length === 0) {
      throw new Error("No services detected for version");
    }

    const spec = {
      name: versionName,
      services,
      timestamp,
      author,
    };

    await createVersion({
      name: versionName,
      spec,
      timestamp,
      author,
    });
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
