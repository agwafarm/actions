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

class ServiceConstruct extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, service: ServiceDefinition) {
    super(scope, id);
    new ServiceStack(this, service.name, { service });
  }
}

const app = new cdk.App();
spec.services.forEach((service) => {
  return new ServiceConstruct(app, service.name, service);
});

app.synth();
