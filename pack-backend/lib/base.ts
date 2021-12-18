import * as cdk from "@aws-cdk/core";
import { DeploymentParameters } from "./types";

export class BaseConstruct extends cdk.Construct {
   public scope: BaseStack;

   public sourceRoot = (): string => this.scope.sourceRoot();

   public isResolved = (name: string): boolean => this.scope.isResolved(name);

   public get ctx(): DeploymentParameters {
      return this.scope.parameters;
   }

   public resolveGlobalResourceName = (name: string): string =>
      this.scope.resolveGlobalResourceName(name);

   public resolveAppResourceName = (name: string): string => {
      if (this.isResolved(name)) {
         return name;
      }

      return `${this.getEnvVariable("APP_ENV")}-${this.getEnvVariable(
         "APP_SERVICE"
      )}-${name}`;
   };

   public resolveFunctionName = (name: string) => {
      if (this.isResolved(name)) {
         return name;
      }

      return `${this.getEnvVariable("APP_ENV")}_${name}-${this.getEnvVariable(
         "APP_SERVICE"
      )}`;
   };

   public resolveFunctionLayerName = (name: string) => {
      if (this.isResolved(name)) {
         return name;
      }

      return `${this.getEnvVariable("APP_ENV")}_${name}-${this.getEnvVariable(
         "APP_SERVICE"
      )}`;
   };

   public resolveSqsQueueName = (name: string): string =>
      this.resolveAppResourceName(this.getEnvVariable(name));

   public resolveBucketName = (name: string): string =>
      this.scope.resolveBucketName(this.getEnvVariable(name));

   public resolveCognitoUserPoolName = (name: string) =>
      this.resolveAppResourceName(name);

   public resolveCognitoIdentityPoolName = (name: string) =>
      this.resolveAppResourceName(name);

   public getErrorSnsTopicArn = (): string => {
      const envName = this.getEnvVariable("APP_ENV");
      const region = this.getEnvVariable("CDK_DEFAULT_REGION");
      const account = this.getEnvVariable("CDK_DEFAULT_ACCOUNT");
      const snsTopicName = `${this.getEnvVariable(
         "APP_ENV"
      )}-errors-notifications-alerts`;
      return `arn:aws:sns:${region}:${account}:${envName}-${snsTopicName}`;
   };

   public resolveSSMParameterName = (
      name: string,
      appendAppName: boolean = true
   ): string => this.scope.resolveSSMParameterName(name, appendAppName);

   public getEnvVariable = (name: string): string =>
      this.scope.getEnvVariable(name);

   public resolveVariableNames = (
      names: string[] | undefined,
      resolver: (name: string) => string
   ): Record<string, string> => {
      return (
         names?.reduce((state, name) => {
            state[name] = resolver(name);
            return state;
         }, {} as Record<string, string>) ?? {}
      );
   };

   constructor(scope: BaseStack, id: string) {
      super(scope, id);
      this.scope = scope;
   }
}

export function getSourceRoot(): string {
   return process.env["SOURCE_FOLDER"] || process.cwd();
}

export class BaseStack extends cdk.Stack {
   public readonly parameters: DeploymentParameters;

   public sourceRoot = (): string => getSourceRoot();

   public isResolved = (name: string): boolean =>
      name.includes(this.getEnvVariable("APP_SERVICE")) ||
      name.includes(this.getEnvVariable("APP_COMPANY_NAME"));

   public getEnvVariable = (name: string): string => {
      if (name === "APP_ENV") {
         return this.parameters.environment;
      }

      const value = process.env[name];
      if (name.startsWith("APP_") && typeof value === "undefined") {
         throw new Error(
            `required env variable: ${name} could not be resolved`
         );
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
         templateUrlPrefix: this.parametrize("TemplateUrlPrefix"),
         lambdaPrefix: this.parametrize("LambdaPrefix"),
         layerPrefix: this.parametrize("LayerPrefix"),
         artifactsBucket: this.parametrize("ArtifactsBucket"),
         companyName: this.parametrize("CompanyName"),
         serviceName: this.parametrize("ServiceName"),
      };
   }
}
