import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as ssm from "@aws-cdk/aws-ssm";
import * as cloudfront from "@aws-cdk/aws-cloudfront";

import { BaseStack } from "./base";

export interface FrontendDeploymentProps extends cdk.StackProps {
  bucketName: string;
  indexDocument: string;
}

export class FrontendDeployment extends BaseStack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id, {});

    let lifecycleRules: s3.LifecycleRule[] | undefined;
    if (this.getEnvVariable("APP_ENV").startsWith("dev")) {
      lifecycleRules = [{ expiration: cdk.Duration.days(14) }];
    }

    const indexPath = this.getEnvVariable("APP_BUCKET_PREFIX") + ".html";
    const websiteBucketName = this.getEnvVariable("APP_BUCKET");
    const websiteBucket = new s3.Bucket(this, "Bucket", {
      websiteIndexDocument: indexPath,
      publicReadAccess: true,
      bucketName: websiteBucketName,
      lifecycleRules,
    });

    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "CloudfrontWebDistribution",
      {
        defaultRootObject: indexPath,
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: websiteBucket,
            },
            behaviors: [
              {
                defaultTtl: cdk.Duration.days(60),
                maxTtl: cdk.Duration.days(60),
                minTtl: cdk.Duration.days(60),
                isDefaultBehavior: true,
              },
            ],
          },
        ],
      }
    );

    new ssm.StringParameter(this, "AppUrlParameter", {
      parameterName: this.resolveSSMParameterName("frontend/url"),
      stringValue: distribution.distributionDomainName,
      simpleName: true,
    });
  }
}
