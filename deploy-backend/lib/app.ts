#!/usr/bin/env node
import "source-map-support/register";
import { register } from "ts-node";

register({ typeCheck: false });
import * as env from "dotenv";
import * as path from "path";
import { getSourceRoot } from "./base";
import { ServiceConfig } from "./types";
import { ServiceApp } from "./ServiceApp";

try {
   const sourceRoot = getSourceRoot();
   env.config({ path: path.join(sourceRoot, ".config") });
   env.config({ path: path.join(sourceRoot, ".env") });

   const configFilePath = path.join(sourceRoot, "app.config.ts");
   const config: ServiceConfig = require(configFilePath).config;
   new ServiceApp(config).synth();
} catch (e) {
   console.log(e);
   throw e;
}
