const {
  SSMClient,
  GetParametersByPathCommand,
} = require("@aws-sdk/client-ssm");

const param = "/infra/version";

new SSMClient({ region: "us-west-2" })
  .send(
    new GetParametersByPathCommand({
      Path: param,
      ParameterFilters: [],
    })
  )
  .then((v) => {
    console.log(v.Parameter);
    const a = 5 + "s";
    console.log(a);
  });
