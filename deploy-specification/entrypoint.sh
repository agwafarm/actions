#!/bin/sh -l

# This will only work in a Docker action since in a repository action the cwd will be the service repo,
# instead of the action folder where the CDK stack resides
export APP_SPEC=$1
cd /action
stacks=$(cdk list)
echo deploying stacks $stacks
cdk deploy --require-approval never $stacks
