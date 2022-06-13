import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as ssm from "@aws-cdk/aws-ssm";
import * as cloudfront from "@aws-cdk/aws-cloudfront";

import { BaseStack } from "./base";

export interface FrontendDeploymentProps extends cdk.StackProps {
  bucketName: string;
  indexDocument: string;
  routingDomain: string;
}

export class FrontendDeployment extends BaseStack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id, {});

    const indexPath = this.getEnvVariable("INDEX_PATH");
    const routingDomain = this.getEnvVariable("ROUTING_DOMAIN");

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
          {
            errorCachingMinTtl: cdk.Duration.days(365).toSeconds(),
            errorCode: 403,
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
        viewerCertificate: {
          aliases: [routingDomain],
          props: {
            acmCertificateArn: "arn:aws:acm:us-east-1:953022346399:certificate/336fae0d-6f3d-4c1c-95eb-9f083c03b57c", // optional
            sslSupportMethod: cloudfront.SSLMethod.SNI
          }
        }
      }
    );

    new ssm.StringParameter(this, "AppUrlParameter", {
      parameterName: this.resolveSSMParameterName("frontend/url"),
      stringValue: distribution.distributionDomainName,
      simpleName: true,
    });
  }
}
