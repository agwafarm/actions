import * as cdk from "@aws-cdk/core";
import * as ssm from "@aws-cdk/aws-ssm";
import * as route53 from "@aws-cdk/aws-route53";

import { BaseStack } from "./base";

interface RecordProps {
  name: string;
  value: string;
}


export class FrontendRoute53 extends BaseStack {
  constructor(scope: cdk.Construct, id: string, accountId: string, record: RecordProps) {
    super(scope, id, { env: {
      region: "us-west-2",
      account: accountId,
    } });
    
    const hostedZoneId = ssm.StringParameter.valueFromLookup(
      this,
      "/account/hosted-zone-id"
    );
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: hostedZoneId,
        zoneName: record.name,
      }
    );
    new route53.CnameRecord(this, "CnameRecord", {
      zone: hostedZone,
      domainName: record.value,
      recordName: record.name,
      ttl: cdk.Duration.minutes(5),
    });
  }
}
