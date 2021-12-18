import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as apigw from "@aws-cdk/aws-apigateway";
import * as ssm from "@aws-cdk/aws-ssm";
import * as path from "path";
import * as fs from "fs";

import { Lambdas } from "./Lambdas";
import {
   HttpBinding,
   LambdaLayerProps,
   LambdaProps,
   ServiceLambdasProps,
} from "./types";
import { Resources } from "./Resources";
import { RestApi } from "./RestApi";
import { BaseStack, BaseConstruct } from "./base";
import { getLambdaProps } from "./getLambdaProps";

export interface ServerlessServiceProps extends cdk.StackProps {
   lambda: ServiceLambdasProps;
   resources: Resources;

   /**
    * Prefix which will be used for HTTP bound lambdas to create an identical resource with IAM Authentication
    */
   iamAuthResourcePrefix?: string;
}

/**
 * Serverless Service Resources
 */
export class ServerlessService extends BaseConstruct {
   private readonly lambdas: Lambdas;
   private readonly api: RestApi;

   constructor(scope: BaseStack, id: string, props: ServerlessServiceProps) {
      super(scope, id);

      const sourceRoot = this.sourceRoot();
      const lambdas = getLambdaProps([path.join(sourceRoot, "src/lambdas")]);
      const layers: LambdaLayerProps[] = [];
      const commonLayersPath = path.join(sourceRoot, "requirements.txt");
      const commonCodePath = path.join(sourceRoot, "src/common");

      if (fs.existsSync(commonLayersPath) || fs.existsSync(commonCodePath)) {
         layers.push({
            name: "cloud-common",
         });
      }

      this.lambdas = new Lambdas(scope, `Lambdas`, {
         ...props.lambda,
         lambdas,
         layers,
         resources: props.resources,
      });

      this.api = this.createRestApi();
      this.bindToHttpApi(props);
   }

   private createRestApi(): RestApi {
      const api = new RestApi(this.scope, "Api");

      new ssm.StringParameter(this, "RestApiUrlParameter", {
         parameterName: this.resolveSSMParameterName("backend/rest/url"),
         stringValue: api.url,
         simpleName: false,
      });

      return api;
   }

   private bindToHttpApi(props: ServerlessServiceProps) {
      const restApiLambdas = this.lambdas.functions
         .filter(([props]) => !!props.config?.triggers?.http)
         .map(([props, fn]) => [props, fn] as [LambdaProps, lambda.IFunction]);

      const authorizer = new apigw.CognitoUserPoolsAuthorizer(
         this,
         "CognitoAuthorizer",
         {
            cognitoUserPools: [props.resources.userPool.userPool],
         }
      );

      restApiLambdas.forEach(([fnProps, fn]) => {
         this.api.bindLambda(
            fn,
            {
               binding: fnProps.config?.triggers?.http?.binding as HttpBinding,
               authorizer,
               authorizationType: apigw.AuthorizationType.COGNITO,
               functionName: fnProps.functionName,
               adminPrefix: props.iamAuthResourcePrefix || "_admin",
            },
            {
               proxy: true,
            }
         );
      });
   }
}
