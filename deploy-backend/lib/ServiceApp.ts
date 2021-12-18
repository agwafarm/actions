import * as cdk from "@aws-cdk/core";

import { ServerlessService } from "./ServerlessService";
import { Resources } from "./Resources";
import { BaseStack } from "./base";
import { ServiceConfig } from "./types";

class ServiceStack extends BaseStack {
   constructor(scope: cdk.Construct, id: string, props: ServiceConfig) {
      super(scope, id, props);

      const resources = new Resources(this, `resources`, {
         s3: props.s3 || {},
         cognito: props.cognito,
      });

      new ServerlessService(this, `service`, {
         lambda: props.lambda,
         resources,
      });
   }
}

export class ServiceApp extends cdk.App {
   constructor(props: ServiceConfig) {
      super();
      new ServiceStack(this, process.env["APP_STACK"] as string, props);
   }
}
