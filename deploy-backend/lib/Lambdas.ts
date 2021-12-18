import * as _ from "lodash";

import * as cdk from "@aws-cdk/core";
import * as fn from "@aws-cdk/aws-lambda";
import * as cwa from "@aws-cdk/aws-cloudwatch-actions";
import * as sns from "@aws-cdk/aws-sns";
import * as iam from "@aws-cdk/aws-iam";
import * as s3 from "@aws-cdk/aws-s3";

import { S3Bucket, grantBucketPermissions } from "./S3Bucket";

import { LambdaConfig, LambdaProps, LambdaLayerProps } from "./types";
import { LambdasProps } from "./types.internal";
import { BaseConstruct, BaseStack } from "./base";

export class Lambdas extends BaseConstruct {
   readonly functions: ReadonlyArray<[LambdaProps, fn.IFunction]>;
   private readonly layers: fn.ILayerVersion[];
   private readonly codeBucket: s3.IBucket;

   constructor(scope: BaseStack, id: string, props: LambdasProps) {
      super(scope, id);

      this.codeBucket = s3.Bucket.fromBucketName(
         this.scope,
         "LambdasCodeBucketRef",
         this.ctx.artifactsBucket
      );

      this.layers = (props.layers || []).map((layer) => {
         const resolvedLayerName = this.resolveFunctionLayerName(layer.name);
         return this.getFunctionLayer(resolvedLayerName, layer);
      });

      this.functions =
         props.lambdas?.map((lambdaProps) => [
            lambdaProps,
            this.createLambda(lambdaProps, props),
         ]) ?? [];
   }

   public createLambda(
      lambdaProps: LambdaProps,
      props: LambdasProps
   ): fn.Function {
      const { handler, functionName, runtime } = lambdaProps;
      const code = this.buildAsS3Object(lambdaProps);

      const resolvedFunctionName = this.resolveFunctionName(functionName);
      lambdaProps.functionName = resolvedFunctionName;

      const layers = (lambdaProps.layers || []).map((layer) => {
         const resolvedLayerName = this.resolveFunctionLayerName(layer.name);
         return this.getFunctionLayer(
            `${resolvedLayerName}-${functionName}`,
            layer
         );
      });

      const lambda = new fn.Function(
         this.scope,
         `${this.getEnvVariable("APP_SERVICE")}${functionName}Func`,
         {
            functionName: resolvedFunctionName,
            runtime,
            code,
            handler,
            timeout: cdk.Duration.seconds(30),
            environment: this.getEnvironmentForLambda(lambdaProps.config),
            currentVersionOptions: {
               removalPolicy: cdk.RemovalPolicy.DESTROY,
            },
            layers: [...this.layers, ...layers],
         }
      );

      if (lambdaProps.config?.triggers?.s3) {
         props.resources.bindToS3Events(
            lambda,
            {
               functionName,
               triggers: lambdaProps.config?.triggers?.s3,
            },
            props
         );
      }

      this.applyManagedPolicies(props, functionName, lambda);
      this.applyPermissionsPolicy(lambdaProps, functionName, lambda);
      this.grantPrincipalPermissions(lambda, lambdaProps);
      this.grantS3Permissions(lambda, lambdaProps, functionName);
      this.addMetricAlarms(functionName, lambda);

      return lambda;
   }

   grantS3Permissions(
      lambda: fn.Function,
      lambdaProps: LambdaProps,
      functionName: string
   ) {
      lambdaProps.config?.permissions?.s3?.forEach((permissions) => {
         const bucketRef = S3Bucket.fromBucketName(
            this.scope,
            `${functionName}${permissions.bucketName}BucketRef`,
            permissions.bucketName
         );

         grantBucketPermissions(bucketRef, lambda, permissions.permissions);
         return permissions;
      });
   }

   grantPrincipalPermissions(lambda: fn.Function, lambdaProps: LambdaProps) {
      lambdaProps.config?.permissions?.servicePrincipals?.forEach(
         (principal) => {
            lambda.grantInvoke(new iam.ServicePrincipal(principal));
         }
      );
   }

   private applyManagedPolicies(
      props: LambdasProps,
      functionName: string,
      lambda: fn.Function
   ) {
      props.managedPolicies?.forEach((policyName) => {
         const policy = iam.ManagedPolicy.fromManagedPolicyArn(
            this.scope,
            `${functionName}${policyName}`,
            `arn:aws:iam::aws:policy/${policyName}`
         );
         (lambda.role as iam.IRole).addManagedPolicy(policy);
      });
   }

   private applyPermissionsPolicy(
      props: LambdaProps,
      functionName: string,
      lambda: fn.Function
   ) {
      const statements = props.config?.permissions?.statements;
      if (!statements) {
         return;
      }

      const lambdaPolicy = new iam.Policy(this.scope, `${functionName}Policy`, {
         statements: statements.map((item) => new iam.PolicyStatement(item)),
      });

      (lambda.role as iam.IRole).attachInlinePolicy(lambdaPolicy);
   }

   private getFunctionLayer(
      resolvedLayerName: string,
      props: LambdaLayerProps
   ): fn.ILayerVersion {
      const s3Key = `${this.ctx.layerPrefix}/${props.name}.zip`;
      return new fn.LayerVersion(
         this.scope,
         `${this.getEnvVariable("APP_SERVICE")}${props.name}Layer`,
         {
            code: fn.Code.fromBucket(this.codeBucket, s3Key),
            layerVersionName: resolvedLayerName,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
         }
      );
   }

   private addMetricAlarms(functionName: string, lambda: fn.Function) {
      const errorTopicArn = this.getErrorSnsTopicArn();
      const topic = sns.Topic.fromTopicArn(
         this.scope,
         `${functionName}ErrorTopicRef`,
         errorTopicArn
      );

      lambda
         .metricErrors()
         .createAlarm(this.scope, `${functionName}ErrorAlarm`, {
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: `SNS Alarm for ${functionName} lambda errors`,
            alarmName: `${this.resolveFunctionName(functionName)}ErrorAlarm`,
         })
         .addAlarmAction(new cwa.SnsAction(topic));

      lambda
         .metricThrottles()
         .createAlarm(this.scope, `${functionName}ThrottleAlarm`, {
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: `SNS Alarm for ${functionName} lambda throttling`,
            alarmName: `${this.resolveFunctionName(functionName)}ThrottleAlarm`,
         })
         .addAlarmAction(new cwa.SnsAction(topic));
   }

   private buildAsS3Object(lambdaProps: LambdaProps): fn.Code {
      const { functionName } = lambdaProps;
      const s3Key = `${this.ctx.lambdaPrefix}/${functionName}.zip`;
      return fn.Code.fromBucket(this.codeBucket, s3Key);
   }

   private getEnvironmentForLambda(
      config: Partial<LambdaConfig> | undefined
   ): Record<string, string> {
      const { inline = {}, map = [], buckets = [] } = config?.env ?? {};
      const fromEnv = _.pick(process.env, map);

      const merged = Object.assign(
         inline,
         fromEnv,
         this.resolveVariableNames(buckets, this.resolveBucketName),
         {
            ENV: this.getEnvVariable("APP_ENV"),
            CORS_ORIGIN: this.getEnvVariable("APP_CORS_ORIGIN"),
            CORS_HEADERS: this.getEnvVariable("APP_CORS_HEADERS"),
            CORS_METHODS: this.getEnvVariable("APP_CORS_METHODS"),
         }
      );

      return _.omitBy(merged, _.isNil) as Record<string, string>;
   }
}
