import * as cdk from "@aws-cdk/core";
import * as ssm from "@aws-cdk/aws-ssm";
import * as route53 from "@aws-cdk/aws-route53";

import { BaseStack } from "./base";


export class FrontendRoute53 extends BaseStack {
  constructor(scope: cdk.Construct, id: string, accountId: string) {
    super(scope, id, { env: {
      region: "us-west-2",
      account: accountId,
    } });

    const stackToDeploy = this.getEnvVariable("STACK");

    if (stackToDeploy === "Route53") {
      const recordName = cdk.Fn.importValue('RoutingDomainOutput');
      const recordValue = cdk.Fn.importValue('CloudFrontDistributionOutput');

      const hostedZoneId = ssm.StringParameter.valueFromLookup(
        this,
        "/account/hosted-zone-id"
      );
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        "HostedZone",
        {
          hostedZoneId: hostedZoneId,
          zoneName: recordName,
        }
      );
      new route53.CnameRecord(this, "CnameRecord", {
        zone: hostedZone,
        domainName: recordValue,
        recordName,
        ttl: cdk.Duration.minutes(5),
      });
    }
  }
}
