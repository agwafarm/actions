#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";

import { Service, ServiceDefinition } from "./Service";

export interface DeploymentSpec {
  services: ServiceDefinition[];
  frontends: ServiceDefinition[];
  env: string;
  version: string;
}

const spec: DeploymentSpec = JSON.parse(process.env["APP_SPEC"] as string);
const app = new cdk.App();

spec.services.forEach((service) => {
  return new Service(app, service.stackName, { service });
});

spec.frontends.forEach((service) => {
  return new Service(app, service.stackName, { service });
});
