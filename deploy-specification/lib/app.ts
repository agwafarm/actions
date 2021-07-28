#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";

import { Service, ServiceDefinition } from "./Service";

export interface DeploymentSpec {
  services: ServiceDefinition[];
}

const spec: DeploymentSpec = JSON.parse(process.env["APP_SPEC"] as string);

console.log("deploying spec");
console.log(JSON.stringify(spec, null, 3));

const app = new cdk.App();
spec.services.forEach((service) => {
  return new Service(app, service.name, service);
});
