#!/bin/bash
set -e
set -u
set -o pipefail

cd /action

# Configure pip to use CodeArtifact as additional pypi
ca_domain=agwafarm-private
ca_repo=agwafarm-private
ca_account=953022346399
ca_token=$(aws codeartifact get-authorization-token --domain $ca_domain --domain-owner $ca_account --query authorizationToken --output text)
ca_region=us-west-2
aws codeartifact login --tool twine --repository $ca_repo --domain $ca_domain --domain-owner $ca_account
pip config set global.extra-index-url https://aws:$ca_token@$ca_domain-$ca_account.d.codeartifact.$ca_region.amazonaws.com/pypi/$ca_repo/simple/

# Compute useful variables
service_name=$GITHUB_REPOSITORY
service_name=$(echo $service_name | sed -e 's/^agwafarm\///')
service_name=$(echo $service_name | sed -e 's/^agwa\-//')

if [ "$service_name" = "cloud-components" ]; then
   service_name=cloud-parent
fi

echo packing service $service_name
echo "::set-output name=service-name::$service_name"

rc_version=$GITHUB_SHA
echo RC version $rc_version
echo "::set-output name=version::$rc_version"

event_name=$GITHUB_EVENT_NAME
echo github event name $event_name

if [ "$event_name" = "pull_request" ]; then
   git_ref=$GITHUB_HEAD_REF
else
   git_ref=$GITHUB_REF
fi
echo git ref $git_ref

branch_name=$(echo $git_ref | sed -e 's/^refs\/heads\///')
echo branch name $branch_name

if [ "$branch_name" = "main" ] || [ "$branch_name" = "master" ]; then
   export AGWA_SERVICE_LIBRARY_TAG=latest
   s3_retainment=standard
else
   user_name=$(echo $GITHUB_ACTOR | sed -e 's/[^[:alnum:]]+/_/g')
   user_name=$(echo $user_name | sed -e 's/\(.*\)/\L\1/')
   echo user name $user_name
   export AGWA_SERVICE_LIBRARY_TAG=edge-$user_name
   s3_retainment=low
fi

echo using library tag $AGWA_SERVICE_LIBRARY_TAG

s3_bucket=agwa-ci-assets
s3_prefix=$s3_retainment/$service_name/$rc_version
export S3_PATH_BASE=s3://$s3_bucket/$s3_prefix
echo s3 bucket $s3_bucket
echo s3 path base $S3_PATH_BASE

#Synthesize CDK apps into cloudformation templates.
mkdir src/cloudformation
export APP_COMPANY_NAME=agwa
export APP_STACK=$service_name
export APP_SERVICE=$service_name
export APP_CORS_ORIGIN="*"
export APP_CORS_HEADERS="Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Accept,User-Agent,Referer"
export APP_CORS_METHODS="OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD"
export SOURCE_FOLDER="/github/workspace"
cdk synthesize --no-version-reporting --asset-metadata false --path-metadata false $APP_STACK >src/cloudformation/main.yaml

#Upload CloudFormation Assets, delete files in target folder if they no longer exist.
aws s3 sync --delete src/cloudformation $S3_PATH_BASE/cloudformation

if [ -d "/github/workspace/src/lambdas" ]; then
   /action/lambdas.sh
fi
