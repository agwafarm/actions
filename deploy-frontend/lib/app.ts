#!/usr/bin/env node
import "source-map-support/register";

import * as env from "dotenv";

env.config({ path: ".config", quiet: true });

import { FrontendApp } from "./FrontendApp";

try {
  new FrontendApp();
} catch (e) {
  console.log(e);
  throw e;
}
