#!/bin/bash

set -e
set -u
set -o pipefail

cd /action

export APP_SPEC=$1
export APP_MODE=$2
export APP_EDGE_DEPLOYMENT=$3

export APP_STACKS=$(cdk list)
# npx cdk bootstrap --force
cdk deploy --require-approval never $APP_STACKS && npx ts-node --prefer-ts-exts ./post-deployment.ts && python3 post_deployment.py
