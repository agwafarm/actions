import * as cdk from "@aws-cdk/core";
import * as cognito from "@aws-cdk/aws-cognito";
import * as iam from "@aws-cdk/aws-iam";
import { BaseConstruct, BaseStack } from "./base";

import { CognitoIdentityIAMProps } from "./types";

export interface CognitoIdentityPoolProps extends CognitoIdentityIAMProps {
   identityPoolName: string;
   userPool: cognito.UserPool;
   userPoolClient: cognito.UserPoolClient;
}

/**
 * Defines an internally managed Cognito Identity Pool
 */
export class CognitoIdentityPool extends BaseConstruct {
   private readonly identityPool: cognito.CfnIdentityPool;
   readonly identityPoolId: string;
   readonly identityPoolName: string;
   readonly authenticatedRole: iam.Role;
   readonly unauthenticatedRole: iam.Role;

   constructor(scope: BaseStack, id: string, props: CognitoIdentityPoolProps) {
      super(scope, id);

      this.identityPoolName = this.resolveCognitoIdentityPoolName(
         props.identityPoolName
      );

      this.identityPool = this.createIdentityPool(scope, props);
      this.identityPoolId = this.identityPool.ref;

      this.authenticatedRole = this.createAuthenticatedRole(scope);
      this.unauthenticatedRole = this.createUnauthenticatedRole(scope);
      this.attachRoles(scope);

      if (props.assumeRoleStatements) {
         for (const roleStatement of props.assumeRoleStatements) {
            roleStatement.addPrincipals(
               new iam.FederatedPrincipal(
                  "cognito-identity.amazonaws.com",
                  {
                     StringEquals: {
                        "cognito-identity.amazonaws.com:aud":
                           this.identityPoolId,
                     },
                     "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                     },
                  },
                  "sts:AssumeRoleWithWebIdentity"
               )
            );
         }
         this.authenticatedRole.assumeRolePolicy?.addStatements(
            ...props.assumeRoleStatements
         );
      }

      if (props.roleStatements) {
         for (const roleStatement of props.roleStatements) {
            this.authenticatedRole?.addToPolicy(roleStatement);
         }
      }

      if (props.managedPolicies) {
         for (const managedPolicy of props.managedPolicies) {
            this.authenticatedRole?.addManagedPolicy(
               iam.ManagedPolicy.fromManagedPolicyArn(
                  scope,
                  managedPolicy.name,
                  managedPolicy.arn
               )
            );
         }
      }
   }

   attachRoles(scope: cdk.Construct) {
      new cognito.CfnIdentityPoolRoleAttachment(scope, "RoleAttachment", {
         identityPoolId: this.identityPoolId,
         roles: {
            authenticated: this.authenticatedRole.roleArn,
            unauthenticated: this.unauthenticatedRole.roleArn,
         },
      });
   }

   createUnauthenticatedRole(scope: cdk.Construct): iam.Role {
      const condition: iam.Condition = {
         StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
         },
         "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
         },
      };

      const assumeRoleAction = "sts:AssumeRoleWithWebIdentity";
      const role = new iam.Role(scope, "UnauthenticatedRole", {
         roleName: this.resolveAppResourceName("unauthenticatedRole"),
         assumedBy: new iam.FederatedPrincipal(
            "cognito-identity.amazonaws.com",
            condition,
            assumeRoleAction
         ),
      });

      return role;
   }

   createAuthenticatedRole(scope: cdk.Construct): iam.Role {
      const condition: iam.Condition = {
         StringEquals: {
            "cognito-identity.amazonaws.com:aud": this.identityPool.ref,
         },
         "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
         },
      };

      const assumeRoleAction = "sts:AssumeRoleWithWebIdentity";
      const role = new iam.Role(scope, "AuthenticatedRole", {
         roleName: this.resolveAppResourceName("authenticatedRole"),
         assumedBy: new iam.FederatedPrincipal(
            "cognito-identity.amazonaws.com",
            condition,
            assumeRoleAction
         ),
      });

      role.addToPolicy(
         new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["cognito-identity:*"],
            resources: ["*"],
         })
      );
      return role;
   }

   createIdentityPool(scope: cdk.Construct, props: CognitoIdentityPoolProps) {
      return new cognito.CfnIdentityPool(scope, "IdentityPool", {
         identityPoolName: this.identityPoolName,
         allowUnauthenticatedIdentities: true,
         allowClassicFlow: true,
         cognitoIdentityProviders: [
            {
               clientId: props.userPoolClient.userPoolClientId,
               serverSideTokenCheck: false,
               providerName: props.userPool.userPoolProviderName,
            },
         ],
      });
   }
}
