import * as cdk from "@aws-cdk/core";

import { FrontendDeployment } from "./FrontendDeployment";
import { FrontendRoute53 } from "./FrontendRoute53";

export class FrontendApp extends cdk.App {
  constructor() {
    super();
    new FrontendDeployment(
      this, 
      process.env["APP_STACK"] as string,
      process.env["ACCOUNT_ID"] as string,
    );
    new FrontendRoute53(
      this,
      `${process.env["APP_STACK"] as string}-route-53`,
      process.env["PROD_AWS_ACCOUNT_ID"] as string,
    );
  }
}
