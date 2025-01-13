#!/usr/bin/env node
import "source-map-support/register";

import * as env from "dotenv";

env.config({ path: ".config" });

import { FrontendApp } from "./FrontendApp";

try {
  new FrontendApp(process.env.DEPLOYED_STACK as string);
} catch (e) {
  console.log(e);
  throw e;
}
