#!/bin/bash

set -e
set -u
set -o pipefail

export APP_SPEC=$1
export APP_MODE=$2

cd /action

export APP_STACKS=$(cdk list)
cdk deploy --require-approval never $APP_STACKS && npx ts-node --prefer-ts-exts ./post-deployment.ts && python3 post_deployment.py
