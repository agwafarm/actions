import * as s3 from "@aws-cdk/aws-s3";
import * as iam from "@aws-cdk/aws-iam";

import { S3BucketPermission, S3BucketProps } from "./types";
import { BaseConstruct, BaseStack } from "./base";

export interface BucketFactory {
   createOrGetBucket(props: S3BucketProps): S3Bucket;
}

/**
 * Creates an S3 bucket. Consider using a globally scoped S3Buckets object instead
 */
export class S3Bucket extends BaseConstruct {
   public readonly instance: s3.Bucket;
   public readonly name: string;

   constructor(scope: BaseStack, id: string, props: S3BucketProps) {
      super(scope, id);
      this.name = this.resolveBucketName(props.name);
      this.instance = new s3.Bucket(this, `Bucket`, {
         ...props,
         bucketName: this.name,
      });

      // manually set CFN property until cdk releases the support for this property
      if (props.transferAcceleration) {
         const cfnBucket = this.instance.node.defaultChild as s3.CfnBucket;
         cfnBucket.accelerateConfiguration = { accelerationStatus: "Enabled" };
      }
   }

   static fromBucketName(
      scope: BaseStack,
      id: string,
      name: string
   ): s3.IBucket {
      name = scope.resolveBucketName(name);
      return s3.Bucket.fromBucketName(scope, id, name);
   }

   grantPermissions(
      grantable: iam.IGrantable,
      permissions: S3BucketPermission[]
   ) {
      grantBucketPermissions(this.instance, grantable, permissions);
   }
}

export function grantBucketPermissions(
   bucket: s3.IBucket,
   grantable: iam.IGrantable,
   permissions: S3BucketPermission[]
) {
   permissions.forEach((permission) => {
      switch (permission) {
         case "r":
            bucket.grantRead(grantable);
            break;
         case "w":
            bucket.grantWrite(grantable);
            break;
         case "rw":
            bucket.grantReadWrite(grantable);
            break;
         case "delete":
            bucket.grantDelete(grantable);
            break;
         case "put":
            bucket.grantPut(grantable);
            break;
      }
   });
}
