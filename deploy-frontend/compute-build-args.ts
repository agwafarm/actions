import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import * as fs from "fs";
import { EOL } from "os";

const app = process.env["APP_SERVICE"];

if (!app) {
  throw new Error("Could not acquire app name");
}

const env = process.env["APP_ENV"] as string;

if (!env) {
  throw new Error("Could not acquire env name");
}

class ConfigurationService {
  private client: SSMClient;

  constructor() {
    this.client = new SSMClient({ region: "us-west-2" });
  }

  getParameter = async (key: string, prefix: string = `${env}`) => {
    console.log(`fetching parameter: ${key} for environment: ${prefix}`);
    const response = await this.client.send(
      new GetParameterCommand({
        Name: `/infra/${prefix}/${key}`,
      })
    );
    console.log("parameter response acquired");
    const value = response.Parameter && response.Parameter.Value;
    if (!value) {
      throw new Error(`could not obtain parameter: ${key}`);
    }
    console.log("returning parameter");
    return value;
  };

  getSecret = async (key: string) => {
    console.log(`fetching parameter: ${key}`);
    const response = await this.client.send(
      new GetParameterCommand({
        Name: `/secret/${key}`,
        WithDecryption: true,
      })
    );
    console.log("parameter response acquired");
    const value = response.Parameter && response.Parameter.Value;
    if (!value) {
      throw new Error(`could not obtain parameter: ${key}`);
    }
    console.log("returning parameter");
    return value;
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();

    const appBackend = await configuration.getParameter(
      `frontend/${app}/backend/id`,
      ""
    );

    const userPoolId = await configuration.getParameter(
      `auth/cognito/user-pool/id/${appBackend}`
    );

    const clientAppId = await configuration.getParameter(
      `auth/cognito/user-pool/client/id/${appBackend}`
    );

    const identityPoolId = await configuration.getParameter(
      `auth/cognito/identity-pool/id/${appBackend}`
    );

    const httpApiUrl = await configuration.getParameter(
      `backend/rest/url/${appBackend}`
    );

    const frontendUrl = await configuration.getParameter(`frontend/url/${app}`);

    const analyticsDashboardEnv = env.startsWith("dev") ? "dev" : env;
    const analyticsDashboardId = await configuration.getParameter(
      "frontend/url/analytics-dashboard/id",
      analyticsDashboardEnv
    );

    const firebaseApiKey = await configuration.getSecret(
      `firebase/${app}/apiKey`
    );

    const firebaseAuthDomain = await configuration.getSecret(
      `firebase/${app}/authDomain`
    );

    const firebaseProjectId = await configuration.getSecret(
      `firebase/${app}/projectId`
    );

    const firebaseAppId = await configuration.getSecret(
      `firebase/${app}/appId`
    );

    const variables = {
      NODE_ENV: "production",
      REACT_APP_USER_POOL_ID: userPoolId,
      REACT_APP_CLIENT_APP_ID: clientAppId,
      REACT_APP_IDENTITY_POOL_ID: identityPoolId,
      REACT_APP_REST_API_URL: httpApiUrl,
      REACT_APP_AWS_REGION: "us-west-2",
      REACT_APP_COOKIE_DOMAIN: frontendUrl,
      REACT_APP_ANALYTICS_DASHBOARD_ID: analyticsDashboardId,
      REACT_APP_FIREBASE_API_KEY: firebaseApiKey,
      REACT_APP_FIREBASE_AUTH_DOMAIN: firebaseAuthDomain,
      REACT_APP_FIREBASE_PROJECT_ID: firebaseProjectId,
      REACT_APP_FIREBASE_APP_ID: firebaseAppId,
    };

    const fileContent = Object.entries(variables)
      .map(([name, value]) => `${name}=${value}`)
      .join(EOL);

    fs.writeFileSync(`buildargs.${env}`, fileContent);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

run();
