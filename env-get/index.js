const core = require("@actions/core");
const dotenv = require("dotenv");
const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");

const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { writeFile } = require("fs/promises");

dotenv.config({ path: ".config" });
dotenv.config({ path: ".env" });

const env = core.getInput("env");

if (!env) {
  throw new Error("Could not acquire env name");
}

const region = core.getInput("awsRegion");

if (!region) {
  throw new Error("Could not acquire aws region");
}

function streamToString(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

class ConfigurationService {
  constructor() {
    this.ssmClient = new SSMClient({ region });
    this.s3Client = new S3Client();
  }

  getParameters = async () => {
    console.log(`fetching parameters for environment: ${env}`);
    const response = await this.ssmClient.send(
      new GetParametersByPathCommand({
        Path: `/infra/rc-version/${env}/`,
      })
    );

    console.log("parameters response acquired");
    console.log(response.Parameters);

    const values = response.Parameters?.map(async (parameter) => {
      const service = parameter.Name.replace(`/infra/rc-version/${env}/`, "");
      const version = parameter.Value;
      const templateUrlPrefix = `${env}/${service}/${version}/cloudformation`;

      const getObjectResult = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: "agwa-ci-assets",
          Key: `${templateUrlPrefix}/main.yaml`,
        })
      );

      const template = streamToString(getObjectResult.Body);
      console.log("template", template);
      const templatePath = `${service}.yaml`;
      await writeFile(templatePath, template, "utf-8");

      return {
        service,
        version,
        template,
        templatePath,
        templateUrlPrefix: `https://s3.amazonaws.com/agwa-ci-assets/${templateUrlPrefix}`,
      };
    });

    const services = await Promise.all(values);
    const stacks = services.map((service) => `${env}-${service}`);
    return { services, stacks };
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();
    const { services, stacks } = await configuration.getParameters();
    core.setOutput("services", JSON.stringify(services));
    core.setOutput("stacks", stacks.join(" "));
  } catch (error) {
    console.log(error);
    core.setFailed(error.message);
  }
}

run();
