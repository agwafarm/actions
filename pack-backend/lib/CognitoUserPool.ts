import * as cdk from "@aws-cdk/core";
import * as cognito from "@aws-cdk/aws-cognito";
import { BaseConstruct, BaseStack } from "./base";

export interface CognitoUserPoolProps {
  userPoolName: string;
  /**
   * @default false
   */
  selfSignUpEnabled?: boolean;
}

/**
 * Defines an internally managed Cognito User Pool
 */
export class CognitoUserPool extends BaseConstruct {
  readonly userPool: cognito.UserPool;
  readonly clientApp: cognito.UserPoolClient;
  readonly resolvedUserPoolName: string;

  constructor(scope: BaseStack, id: string, props: CognitoUserPoolProps) {
    super(scope, id);
    this.resolvedUserPoolName = this.resolveCognitoUserPoolName(
      props.userPoolName
    );
    this.userPool = this.createUserPool(props.userPoolName, props);
    this.clientApp = this.createClientApp(props.userPoolName);
  }

  createUserPool(
    userPoolName: string,
    props: CognitoUserPoolProps
  ): cognito.UserPool {
    return new cognito.UserPool(this, `${userPoolName}UserPool`, {
      userPoolName: this.resolvedUserPoolName,
      selfSignUpEnabled: props.selfSignUpEnabled || false,
      signInAliases: {
        username: true,
        email: true,
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        fullname: {
          required: true,
          mutable: true,
        },
        email: {
          required: true,
          mutable: true,
        },
        emailVerified: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: true,
        requireDigits: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      customAttributes: {
        iot_policy_attached: new cognito.BooleanAttribute({
          mutable: true,
        }),
        role: new cognito.StringAttribute({
          mutable: true,
        }),
      },
    });
  }

  createClientApp(userPoolName: string) {
    /**
     * by default cognito enables clients to write to all attributes, event email_verified!
     * We override this default behavior by replacing it with our own
     */
    const writeAttributes =
      new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        emailVerified: false,
        fullname: true,
      });

    const clientApp = this.userPool.addClient(
      `${userPoolName}UserPoolClientApp`,
      {
        supportedIdentityProviders: [
          cognito.UserPoolClientIdentityProvider.COGNITO,
        ],
        preventUserExistenceErrors: true,
        authFlows: {
          userPassword: true,
        },
        writeAttributes,
      }
    );

    return clientApp;
  }
}
