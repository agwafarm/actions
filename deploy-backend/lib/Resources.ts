import * as cdk from "@aws-cdk/core";
import * as ssm from "@aws-cdk/aws-ssm";
import * as fn from "@aws-cdk/aws-lambda";

import { S3LambdaBinding } from "./S3LambdaBinding";
import { S3Buckets } from "./S3Buckets";
import { CognitoUserPool } from "./CognitoUserPool";
import { CognitoIdentityPool } from "./CognitoIdentityPool";

import {
   CognitoIdentityIAMProps,
   S3LambdaTriggers,
   S3BucketsProps,
} from "./types";
import { LambdasProps } from "./types.internal";

import { BaseConstruct, BaseStack } from "./base";

export interface ResourcesProps extends cdk.StackProps {
   s3: S3BucketsProps;
   cognito: CognitoIdentityIAMProps | undefined;
}

export interface LambdaS3BindingOptions {
   triggers: S3LambdaTriggers;
   functionName: string;
}

/**
 * Static Service Resources
 */
export class Resources extends BaseConstruct {
   readonly buckets: S3Buckets;
   readonly userPool: CognitoUserPool;
   readonly identityPool: CognitoIdentityPool;

   constructor(scope: BaseStack, id: string, props: ResourcesProps) {
      super(scope, id);
      const { identityPool, userPool } = this.createCognitoResources(props);
      this.userPool = userPool;
      this.identityPool = identityPool;
      this.buckets = this.createS3Buckets(props);
   }

   private createS3Buckets(props: ResourcesProps): S3Buckets {
      const buckets = new S3Buckets(this.scope, `S3`, props.s3);
      props.s3?.buckets?.forEach((bucketProps) => {
         if (!bucketProps.authenticatedUserPermissions) {
            return;
         }
         const bucket = buckets.createOrGetBucket(bucketProps);
         bucket.grantPermissions(
            this.identityPool.authenticatedRole,
            bucketProps.authenticatedUserPermissions
         );
      });
      return buckets;
   }

   private createCognitoResources(props: ResourcesProps) {
      const userPool = new CognitoUserPool(this.scope, "CognitoUserPool", {
         userPoolName: "users",
      });

      new ssm.StringParameter(this, "CognitoUserPoolIdParameter", {
         parameterName: this.resolveSSMParameterName(
            "auth/cognito/user-pool/id"
         ),
         simpleName: false,
         stringValue: userPool.userPool.userPoolId,
      });

      new ssm.StringParameter(this, "CognitoUserPoolClientAppIdParameter", {
         parameterName: this.resolveSSMParameterName(
            "auth/cognito/user-pool/client/id"
         ),
         simpleName: false,
         stringValue: userPool.clientApp.userPoolClientId,
      });

      const identityPool = new CognitoIdentityPool(
         this.scope,
         "CognitoIdentityPool",
         {
            ...(props.cognito || {}),
            userPool: userPool.userPool,
            userPoolClient: userPool.clientApp,
            identityPoolName: "identities",
         }
      );

      new ssm.StringParameter(this, "CognitoIdentityPoolIdParameter", {
         parameterName: this.resolveSSMParameterName(
            "auth/cognito/identity-pool/id"
         ),
         stringValue: identityPool.identityPoolId,
         simpleName: false,
      });

      return { userPool, identityPool };
   }

   public bindToS3Events(
      lambda: fn.Function,
      options: LambdaS3BindingOptions,
      props: LambdasProps
   ) {
      const binding = new S3LambdaBinding(
         this.scope,
         `${options.functionName}S3LambdaBinding`,
         {
            functionName: options.functionName,
            fn: lambda,
            triggers: options.triggers,
            bucketFactory: props.resources.buckets,
         }
      );

      binding.bucketTriggers.forEach(([trigger, bucket]) => {
         if (trigger.bucketProps.authenticatedUserPermissions) {
            bucket.grantPermissions(
               props.resources.identityPool.authenticatedRole,
               trigger.bucketProps.authenticatedUserPermissions
            );
         }
      });
   }
}
