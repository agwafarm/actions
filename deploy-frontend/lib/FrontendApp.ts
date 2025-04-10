import * as cdk from "@aws-cdk/core";

import { FrontendDeployment } from "./FrontendDeployment";

export class FrontendApp extends cdk.App {
  constructor() {
    super();
    const awsProfile = process.env["AWS_PROFILE"] as string;
    const awsProdProfile = process.env["AWS_PROD_PROFILE"] as string;
    const awsDevProfile = process.env["AWS_DEV_PROFILE"] as string;
    const deployDnsRecord = awsProfile === awsProdProfile;
    const isNonDevAccountBucket = awsProfile !== awsDevProfile;

    new FrontendDeployment(
      this,
      process.env["APP_STACK"] as string,
      process.env["ACCOUNT_ID"] as string,
      deployDnsRecord,
      isNonDevAccountBucket
    );
  }
}
