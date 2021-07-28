#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";

import { ServiceStack, ServiceDefinition } from "./ServiceStack";

export interface DeploymentSpec {
  services: ServiceDefinition[];
}

const spec: DeploymentSpec = JSON.parse(process.env["APP_SPEC"] as string);

console.log("deploying spec");
console.log(JSON.stringify(spec, null, 3));

const app = new cdk.App();
spec.services.forEach((service) => {
  return new ServiceStack(app, service.name, { service });
});
