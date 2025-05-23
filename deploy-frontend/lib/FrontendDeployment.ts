import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as ssm from "@aws-cdk/aws-ssm";
import * as iam from "@aws-cdk/aws-iam";
import * as cloudfront from "@aws-cdk/aws-cloudfront";
import * as route53 from "@aws-cdk/aws-route53";

import { BaseStack } from "./base";

export interface FrontendDeploymentProps extends cdk.StackProps {
  bucketName: string;
  indexDocument: string;
}

export class FrontendDeployment extends BaseStack {
  constructor(
    scope: cdk.Construct,
    id: string,
    accountId: string,
    deployDnsRecord: boolean,
    isNonDevAccountBucket: boolean
  ) {
    super(scope, id, {
      env: {
        region: "us-west-2",
        account: accountId,
      },
    });

    const indexPath = this.getEnvVariable("INDEX_PATH");
    const routingDomain = this.getEnvVariable("ROUTING_DOMAIN");

    const websiteBucketName = this.getEnvVariable("APP_BUCKET");
    const websiteBucket = new s3.Bucket(this, "Bucket", {
      websiteIndexDocument: indexPath,
      publicReadAccess: true,
      bucketName: websiteBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    });

    if (isNonDevAccountBucket) {
      websiteBucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowAccountBReadAccess",
          effect: iam.Effect.ALLOW,
          principals: [
            new iam.ArnPrincipal("arn:aws:iam::471112775292:user/github"),
          ],
          actions: ["s3:GetObject"],
          resources: [`${websiteBucket.bucketArn}/*`],
        })
      );

      websiteBucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: "AllowAccountBListAccess",
          effect: iam.Effect.ALLOW,
          principals: [
            new iam.ArnPrincipal("arn:aws:iam::471112775292:user/github"),
          ],
          actions: ["s3:ListBucket"],
          resources: [websiteBucket.bucketArn],
        })
      );
    }

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
            acmCertificateArn: this.getSslCert(accountId),
            sslSupportMethod: cloudfront.SSLMethod.SNI,
          },
        },
      }
    );

    new ssm.StringParameter(this, "AppUrlParameter", {
      parameterName: this.resolveSSMParameterName("frontend/url"),
      stringValue: distribution.distributionDomainName,
      simpleName: true,
    });

    new ssm.StringParameter(this, "AppDNSUrlParameter", {
      parameterName: this.resolveSSMParameterName("frontend/dns-url"),
      stringValue: routingDomain,
      simpleName: true,
    });

    if (deployDnsRecord) {
      const hostedZoneId = ssm.StringParameter.valueFromLookup(
        this,
        "/account/hosted-zone-id"
      );
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        "HostedZone",
        {
          hostedZoneId: hostedZoneId,
          zoneName: routingDomain,
        }
      );
      new route53.CnameRecord(this, "CnameRecord", {
        zone: hostedZone,
        domainName: distribution.distributionDomainName,
        recordName: routingDomain,
        ttl: cdk.Duration.minutes(5),
      });
    }
  }
}
