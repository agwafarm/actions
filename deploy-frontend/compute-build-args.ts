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

const frontendRoutingDomain = process.env["ROUTING_DOMAIN"];

if (!frontendRoutingDomain) {
  throw new Error("Could not acquire frontend routing domain");
}

class ConfigurationService {
  private client: SSMClient;

  constructor() {
    this.client = new SSMClient({ region: "us-west-2" });
  }

  getEnvParameter = async (
    key: string,
    paramEnvironment?: string,
    withPrefix: boolean = true
  ) => {
    const name = withPrefix
      ? `/infra/${paramEnvironment || env}/${key}`
      : `/${paramEnvironment || env}/${key}`;
    console.log(`fetching parameter: ${name}`);
    const response = await this.client.send(
      new GetParameterCommand({
        Name: name,
      })
    );
    const value = response.Parameter && response.Parameter.Value;
    if (!value) {
      throw new Error(`could not obtain parameter: ${name}`);
    }
    return value;
  };

  getParameter = async (key: string) => {
    const name = `/infra/${key}`;
    console.log(`fetching parameter: ${name}`);
    const response = await this.client.send(
      new GetParameterCommand({
        Name: name,
      })
    );
    const value = response.Parameter && response.Parameter.Value;
    if (!value) {
      throw new Error(`could not obtain parameter: ${name}`);
    }
    return value;
  };

  getSecret = async (key: string) => {
    const response = await this.client.send(
      new GetParameterCommand({
        Name: `/secret/${key}`,
        WithDecryption: true,
      })
    );

    const value = response.Parameter && response.Parameter.Value;
    if (!value) {
      throw new Error(`could not obtain parameter: ${key}`);
    }

    return value;
  };
}

async function run() {
  try {
    const configuration = new ConfigurationService();

    let appBackend = "";
    try {
      appBackend = await configuration.getParameter(
        `frontend/${app}/backend/id`
      );
    } catch (e) {}

    let userPoolId = "";
    try {
      userPoolId = await configuration.getEnvParameter(
        `auth/cognito/user-pool/id/${appBackend}`
      );
    } catch (e) {}

    let clientAppId = "";
    try {
      clientAppId = await configuration.getEnvParameter(
        `auth/cognito/user-pool/client/id/${appBackend}`
      );
    } catch (e) {}

    let identityPoolId = "";
    try {
      identityPoolId = await configuration.getEnvParameter(
        `auth/cognito/identity-pool/id/${appBackend}`
      );
    } catch (e) {}

    let httpApiUrl = "";
    try {
      httpApiUrl = await configuration.getEnvParameter(
        `backend/rest/url/${appBackend}`
      );
    } catch (e) {}

    let analyticsDashboardId = "";
    try {
      const analyticsDashboardEnv = env.startsWith("dev") ? "dev" : env;
      analyticsDashboardId = await configuration.getEnvParameter(
        "frontend/url/analytics-dashboard/id",
        analyticsDashboardEnv
      );
    } catch (e) {}

    let firebaseApiKey = "";
    try {
      firebaseApiKey = await configuration.getSecret(`firebase/${app}/apiKey`);
    } catch (e) {}

    let firebaseAuthDomain = "";
    try {
      firebaseAuthDomain = await configuration.getSecret(
        `firebase/${app}/authDomain`
      );
    } catch (e) {}

    let plantImageBaseUrl = "";

    try {
      plantImageBaseUrl = await configuration.getEnvParameter(
        "cloudfront/url/plant-admin-public"
      );
      plantImageBaseUrl = `https://${plantImageBaseUrl}/images/vegetables`;
    } catch (e) {}

    let firebaseProjectId = "";
    try {
      firebaseProjectId = await configuration.getSecret(
        `firebase/${app}/projectId`
      );
    } catch (e) {}

    let firebaseAppId = "";
    try {
      firebaseAppId = await configuration.getSecret(`firebase/${app}/appId`);
    } catch (e) {}

    let intercomAppId = "";
    try {
      intercomAppId = await configuration.getSecret("intercom/appId");
    } catch (e) {}

    let mixpanelToken = "";
    try {
      mixpanelToken = await configuration.getEnvParameter(
        "agwa_m/mixpanel_token-ssm-param",
        env,
        false
      );
    } catch (e) {}

    let smartlookApiKey = "";
    try {
      smartlookApiKey = await configuration.getSecret("smartlook/api_key");
    } catch (e) {}

    const mqttEndpoint = await configuration.getParameter(`mqtt/endpoint`);

    const variables = {
      NODE_ENV: "production",
      REACT_APP_USER_POOL_ID: userPoolId,
      REACT_APP_CLIENT_APP_ID: clientAppId,
      REACT_APP_IDENTITY_POOL_ID: identityPoolId,
      REACT_APP_REST_API_URL: httpApiUrl,
      REACT_APP_AWS_REGION: "us-west-2",
      REACT_APP_COOKIE_DOMAIN: frontendRoutingDomain,
      REACT_APP_ANALYTICS_DASHBOARD_ID: analyticsDashboardId,
      REACT_APP_FIREBASE_API_KEY: firebaseApiKey,
      REACT_APP_FIREBASE_AUTH_DOMAIN: firebaseAuthDomain,
      REACT_APP_FIREBASE_PROJECT_ID: firebaseProjectId,
      REACT_APP_FIREBASE_APP_ID: firebaseAppId,
      REACT_APP_MQTT_ENDPOINT: mqttEndpoint,
      REACT_APP_AGWA_ENV: env,
      REACT_APP_PLANT_IMAGE_BASE_URL: plantImageBaseUrl,
      REACT_APP_INTERCOM_APP_ID: intercomAppId,
      REACT_APP_MIXPANEL_TOKEN: mixpanelToken,
      REACT_APP_SMARTLOOK_API_KEY: smartlookApiKey,
    };

    console.log("variables: ", JSON.stringify(variables, null, 3));

    const fileContent = Object.entries(variables)
      .map(([name, value]) => `${name}=${value}`)
      .join(EOL);

    fs.writeFileSync(`/github/workspace/buildargs.${env}`, fileContent);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

run();
