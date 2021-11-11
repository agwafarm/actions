import * as cdk from "@aws-cdk/core";
import { DeploymentParameters } from "./types";

export class BaseStack extends cdk.Stack {
  public readonly parameters: DeploymentParameters;

  public isResolved = (name: string): boolean =>
    name.includes(this.getEnvVariable("APP_SERVICE")) ||
    name.includes(this.getEnvVariable("APP_COMPANY_NAME"));

  public getEnvVariable = (name: string): string => {
    if (name === "APP_ENV") {
      return this.parameters.environment;
    }

    if (name === "APP_BUCKET") {
      return this.parameters.bucket;
    }

    if (name === "INDEX_PATH") {
      return this.parameters.indexPath;
    }

    const value = process.env[name];
    if (name.startsWith("APP_") && typeof value === "undefined") {
      throw new Error(`required env variable: ${name} could not be resolved`);
    }

    return value || name;
  };

  public resolveGlobalResourceName = (name: string): string => {
    if (this.isResolved(name)) {
      return name;
    }
    return `${this.getEnvVariable("APP_ENV")}-${this.getEnvVariable(
      "APP_COMPANY_NAME"
    )}-${name}`;
  };

  public resolveBucketName = (name: string): string =>
    this.resolveGlobalResourceName(this.getEnvVariable(name));

  public resolveSSMParameterName = (
    name: string,
    appendAppName: boolean = true
  ): string =>
    `/infra/${this.getEnvVariable("APP_ENV")}/${name}${
      appendAppName ? `/${this.getEnvVariable("APP_SERVICE")}` : ""
    }`;

  private parametrize = (name: string): string => {
    return new cdk.CfnParameter(this, name, {
      type: "String",
    }).valueAsString;
  };

  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    this.parameters = {
      environment: this.parametrize("Environment"),
      bucket: this.parametrize("BucketName"),
      bucketPrefix: this.parametrize("BucketPrefix"),
      indexPath: this.parametrize("IndexPath"),
    };
  }
}
