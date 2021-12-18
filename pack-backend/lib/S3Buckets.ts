import * as ssm from "@aws-cdk/aws-ssm";

import { S3Bucket, BucketFactory } from "./S3Bucket";
import { S3BucketProps, S3BucketsProps } from "./types";
import { BaseConstruct, BaseStack } from "./base";

/**
 * Creates bucket resources and holds on to their references so that stacks can reuse instances.
 * All buckets will be created in the constructor passed scope.
 */
export class S3Buckets extends BaseConstruct implements BucketFactory {
   private readonly _buckets: Record<string, S3Bucket>;

   constructor(scope: BaseStack, id: string, props: S3BucketsProps) {
      super(scope, id);
      this._buckets = {};
      this.scope = scope;
      props.buckets?.forEach((bucketProps) =>
         this.createOrGetBucket(bucketProps)
      ) ?? [];
   }

   public createOrGetBucket = (props: S3BucketProps): S3Bucket => {
      const resolvedName = this.resolveBucketName(props.name);
      const paramName = this.getEnvVariable(props.name);
      const existing = this._buckets[resolvedName];

      if (existing) {
         return existing;
      }

      const bucket = new S3Bucket(this.scope, `${paramName}Bucket`, props);
      if (props.ssm) {
         new ssm.StringParameter(
            this.scope,
            `${paramName}BucketNameParameter`,
            {
               parameterName: this.resolveSSMParameterName(
                  `buckets/${paramName}`,
                  false
               ),
               stringValue: resolvedName,
               simpleName: false,
            }
         );
      }
      this._buckets[bucket.name] = bucket;
      return bucket;
   };
}
