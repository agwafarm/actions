import * as fn from "@aws-cdk/aws-lambda";
import * as s3 from "@aws-cdk/aws-s3";
import * as iam from "@aws-cdk/aws-iam";
import * as cdk from "@aws-cdk/core";

export interface ServiceLambdasProps {
   /**
    * Managed policies to grant all lambda functions
    */
   managedPolicies?: string[];
}

export interface ServiceConfig extends cdk.StackProps {
   lambda: ServiceLambdasProps;
   s3?: S3BucketsProps;
   cognito?: CognitoIdentityIAMProps;
}

export interface S3BucketsProps {
   buckets?: S3BucketProps[];
}

export interface ManagedPolicy {
   name: string;
   arn: string;
}

export interface CognitoIdentityIAMProps {
   assumeRoleStatements?: iam.PolicyStatement[];
   roleStatements?: iam.PolicyStatement[];
   managedPolicies?: ManagedPolicy[];
}

export interface DeploymentParameters {
   environment: string;
   templateUrlPrefix: string;
   serviceName: string;
   companyName: string;
   lambdaPrefix: string;
   layerPrefix: string;
   artifactsBucket: string;
}

export interface S3BucketProps extends Omit<s3.BucketProps, "bucketName"> {
   name: string;

   /**
    * Persists the bucket name in SSM Parameter Store
    */
   ssm?: boolean;

   /**
    * Permissions to grant user pool authenticated identities
    */
   authenticatedUserPermissions?: S3BucketPermission[];

   // enable S3TA
   transferAcceleration?: boolean;
}

export type S3BucketPermission = "r" | "w" | "rw" | "delete" | "put";

export interface S3BucketPermissions {
   bucketName: string;
   permissions: S3BucketPermission[];
}

export interface HttpBinding {
   path: string;
   method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH" | "OPTIONS";
}

/**
 * Enables passing environment variables to the function
 */
export interface LambdaEnvironment {
   /**
    * environment values to provide to the function
    */
   inline?: Record<string, string>;

   /**
    * environment variables to resolve at build time
    */
   map?: string[];

   /**
    * Bucket names to be resolved at build time
    */
   buckets?: string[];
}

/**
 * Enables granting the function access to resources
 */
export interface LambdaPermissions {
   /**
    * Enables granting the function access to s3 buckets
    */
   s3?: S3BucketPermissions[];

   /**
    * Enables AWS services to invoke the lambda function
    */
   servicePrincipals?: string[];

   /**
    * Enables lambdas to receive required permissions
    */
   statements?: iam.PolicyStatementProps[];
}

export interface S3LambdaTrigger {
   /**
    * Event types which should trigger the lambda
    */
   eventTypes: s3.EventType[];

   /**
    * Bucket properties
    */
   bucketProps: S3BucketProps;
}

export interface S3LambdaTriggers {
   maxRetries: number;
   items: S3LambdaTrigger[];
}

/**
 * Exposes the lambda function via HTTP. Implicitly creates a cognito user pool
 */
export interface HttpLambdaTrigger {
   binding: HttpBinding;
}

/**
 * Enables the function to be triggered by various event sources
 */
export interface LambdaTriggers {
   /**
    * Invokes the function via an API Gateway REST API, using a Cognito User Pool authorizer.
    */
   http?: HttpLambdaTrigger;

   /**
    * Invokes the function via SQS regular queue based batching when S3 bucket events occur.
    * Also creates the buckets and a single queue which batches the events.
    * The queue is attached to a dead letter queue, where failed batches are placed after maxRetries has elapsed.
    */
   s3?: S3LambdaTriggers;
}

/**
 * Enables the function to interact with various AWS components
 */
export interface LambdaConfig {
   /**
    * Function triggers
    */
   triggers: LambdaTriggers;

   /**
    * Enables passing environment variables to the function
    */
   env?: LambdaEnvironment;

   /**
    * Function permissions
    */
   permissions?: LambdaPermissions;
}

/**
 * Enables functions to use local dependencies.
 * These are not versioned- only the latest layer is retained, per environment.
 */
export interface NamedLambdaLayerProps {
   /**
    * Lambda Layer name
    */
   name: string;
}

export type LambdaLayerProps = NamedLambdaLayerProps;

/**
 * Props used to create a lambda function
 */
export interface LambdaProps {
   /**
    * Lambda handler (e.g. file.function)
    */
   handler: string;

   /**
    * Unique function name
    */
   functionName: string;

   /**
    * Lambda runtime
    */
   runtime: fn.Runtime;

   /**
    * Function configuration
    */
   config?: Partial<LambdaConfig>;

   /**
    * Function Layers
    */
   layers?: LambdaLayerProps[];
}
