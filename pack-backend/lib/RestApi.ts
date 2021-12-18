import * as apigw from "@aws-cdk/aws-apigateway";
import * as fn from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";
import * as _ from "lodash";

import { HttpBinding } from "./types";
import { BaseConstruct, BaseStack } from "./base";
export interface BindLambdaOptions {
   authorizer: apigw.IAuthorizer | undefined;
   authorizationType: apigw.AuthorizationType | undefined;
   binding: HttpBinding;
   adminPrefix: string;
   functionName: string;
}

export class RestApi extends BaseConstruct {
   readonly api: apigw.RestApi;
   readonly url: string;

   constructor(scope: BaseStack, id: string) {
      super(scope, id);
      const headers = [
         ...this.getEnvVariable("APP_CORS_HEADERS").split(","),
         ...apigw.Cors.DEFAULT_HEADERS,
      ];
      const api = new apigw.RestApi(scope, "RestApi", {
         retainDeployments: false,
         restApiName: this.resolveAppResourceName("api"),
         defaultCorsPreflightOptions: {
            allowOrigins: apigw.Cors.ALL_ORIGINS,
            allowMethods: apigw.Cors.ALL_METHODS,
            allowHeaders: _.uniq(headers),
         },
      });

      this.api = api;
      this.url = api.url;
   }

   bindLambda(
      func: fn.IFunction,
      options: BindLambdaOptions,
      integration: apigw.LambdaIntegrationOptions
   ) {
      func.grantInvoke(new iam.ServicePrincipal("apigateway.amazonaws.com"));

      this.enableLambdaInvoke(func, options, integration);
      this.enableAdminInvoke(func, integration, options);
      this.removeAuthFromOptions();
   }

   private enableLambdaInvoke(
      func: fn.IFunction,
      options: BindLambdaOptions,
      integration: apigw.LambdaIntegrationOptions
   ) {
      const { binding, authorizer, authorizationType } = options;

      const resource = this.api.root.resourceForPath(binding.path);
      resource.addMethod(
         binding.method,
         new apigw.LambdaIntegration(func, integration),
         {
            authorizer,
            authorizationType,
         }
      );
   }

   private enableAdminInvoke(
      func: fn.IFunction,
      integration: apigw.LambdaIntegrationOptions,
      options: BindLambdaOptions
   ) {
      const adminResource = this.api.root.resourceForPath(
         `${options.adminPrefix}${options.binding.path}`
      );

      adminResource.addMethod(
         options.binding.method,
         new apigw.LambdaIntegration(func, integration),
         {
            authorizationType: apigw.AuthorizationType.IAM,
         }
      );
   }

   private removeAuthFromOptions() {
      //Remove authorization from automatically created OPTIONS methods.
      //If we do not do this, CORS will fail since the browser will make an unauthenticated request.
      this.api.methods.forEach((apiMethod) => {
         const child = apiMethod.node.findChild("Resource") as apigw.CfnMethod;
         if (apiMethod.httpMethod === "OPTIONS") {
            child.addPropertyOverride("AuthorizationType", "NONE");
         }
      });
   }
}
