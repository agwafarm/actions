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

    const indexPath = this.getEnvVariable("INDEX_PATH");

    const websiteBucketName = this.getEnvVariable("APP_BUCKET");
    const websiteBucket = new s3.Bucket(this, "Bucket", {
      websiteIndexDocument: indexPath,
      publicReadAccess: true,
      bucketName: websiteBucketName,
    });

    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "CloudfrontWebDistribution",
      {
        defaultRootObject: indexPath,
        errorConfigurations: [
          // Give SPA control over navigation- reroute all 404 to index.html
          {
            errorCachingMinTtl: cdk.Duration.days(365).toSeconds(),
            errorCode: 404,
            responseCode: 200,
            responsePagePath: this.getEnvVariable("NOT_FOUND_PATH"),
          },
        ],
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: websiteBucket,
            },
            behaviors: [
              {
                // index.html should not be cached based on name
                defaultTtl: cdk.Duration.seconds(0),
                maxTtl: cdk.Duration.days(0),
                minTtl: cdk.Duration.days(0),
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
