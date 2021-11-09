#!/bin/sh -l

# This will only work in a Docker action since in a repository action the cwd will be the service repo,
# instead of the action folder where the CDK stack resides
export APP_SPEC=$1
export APP_MODE=$2

cd /action

export APP_STACKS=$(cdk list)
cdk deploy --require-approval never $APP_STACKS && node ./post-deployment.js
