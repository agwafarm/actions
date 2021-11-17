import * as cdk from "@aws-cdk/core";

import { FrontendDeployment } from "./FrontendDeployment";

export class FrontendApp extends cdk.App {
  constructor() {
    super();
    new FrontendDeployment(this, process.env["APP_STACK"] as string);
  }
}
