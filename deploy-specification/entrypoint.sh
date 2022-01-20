#!/bin/bash

set -e
set -u
set -o pipefail

export APP_SPEC=$1
export APP_MODE=$2

cd /action

export APP_STACKS=$(cdk list)
cdk deploy --require-approval never $APP_STACKS && npx ts-node --prefer-ts-exts ./post-deployment.ts

ca_domain=agwafarm-private
ca_repo=agwafarm-private
ca_account=953022346399
ca_token=$(aws codeartifact get-authorization-token --domain $ca_domain --domain-owner $ca_account --query authorizationToken --output text)
ca_region=us-west-2
aws codeartifact login --tool twine --repository $ca_repo --domain $ca_domain --domain-owner $ca_account
pip config set global.extra-index-url https://aws:$ca_token@$ca_domain-$ca_account.d.codeartifact.$ca_region.amazonaws.com/pypi/$ca_repo/simple/
python3 -m pip install -q -r requirements.txt
python3 post_deployment.py
