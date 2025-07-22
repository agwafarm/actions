import {
  Duration,
  StackProps,
  aws_s3 as s3,
  aws_ssm as ssm,
  aws_iam as iam,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { BaseStack } from "./base";

export interface FrontendDeploymentProps extends StackProps {
  bucketName: string;
  indexDocument: string;
}

export class FrontendDeployment extends BaseStack {
  constructor(
    scope: Construct,
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

    const distribution = new cloudfront.Distribution(
      this,
      "CloudfrontWebDistribution",
      {
        defaultRootObject: indexPath,
        defaultBehavior: {
          origin: new origins.S3Origin(websiteBucket),
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // SPA, no HTML caching
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        errorResponses: [
          // Give SPA control over navigation- reroute all 404 to index.html
          {
            ttl: Duration.days(365),
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: this.getEnvVariable("NOT_FOUND_PATH"),
          },
          {
            ttl: Duration.days(365),
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: this.getEnvVariable("NOT_FOUND_PATH"),
          },
        ],
        domainNames: [routingDomain],
        certificate: acm.Certificate.fromCertificateArn(
          this,
          "Certificate",
          this.getSslCert(accountId)
        ),
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
        ttl: Duration.minutes(5),
      });
    }
  }
}
