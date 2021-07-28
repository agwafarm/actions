#!/bin/sh -l

# This will only work in a Docker action since in a repository action the cwd will be the service repo,
# instead of the action folder where the CDK stack resides
export APP_SPEC=$1
export BASE_FOLDER=$(pwd)

echo base folder $BASE_FOLDER
ls -la $BASE_FOLDER

ls -la ./specs

cd /action
stacks=$(cdk list)
echo deploying stacks $stacks
npm run deploy -- $stacks
