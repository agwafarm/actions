#!/bin/bash
set -e
set -u
set -o pipefail

cd /action

service_name=$GITHUB_REPOSITORY

service_name=$(echo $service_name | sed -e 's/^agwafarm\///')
service_name=$(echo $service_name | sed -e 's/^agwa\-//')

echo deploying frontend $service_name

rc_version=$GITHUB_SHA
echo RC version $rc_version

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
   s3_retainment=standard
   target_env=ci
else
   s3_retainment=low

   user_name=$(echo $GITHUB_ACTOR | sed -e 's/[^[:alnum:]]+/_/g')
   user_name=$(echo $user_name | sed -e 's/\(.*\)/\L\1/')
   target_env=dev$user_name
fi

# prepare CDK variables
export APP_BUCKET=$target_env-agwa-$service_name
echo app bucket $APP_BUCKET

export APP_SERVICE=$service_name
export APP_ENV=$target_env
export APP_BUCKET_PREFIX=$rc_version
export APP_COMPANY_NAME=agwa
export APP_STACK=$target_env-$service_name
echo app stack $APP_STACK

# deploy to the ci / dev environment
export APP_STACKS=$(cdk list)
cdk deploy --require-approval never $APP_STACKS --parameters Environment=$APP_ENV --parameters BucketName=$APP_BUCKET --parameters BucketPrefix=$APP_BUCKET_PREFIX

# compute build arguments
npx ts-node --prefer-ts-exts ./compute-build-args.ts
set -o allexport
source ./buildargs.env
set +o allexport

# build
npm run build

# copy build to ci / dev buckets
aws s3 sync --delete build s3://$APP_BUCKET/$APP_BUCKET_PREFIX
aws s3 cp build/index.html s3://$APP_BUCKET/$APP_BUCKET_PREFIX.html

# persist web assets and cloudformation output on merge to the default branch
if [ "$s3_retainment" = "standard" ]; then
   s3_path_base=s3://agwa-ci-assets/$s3_retainment/$service_name/$rc_version

   # copy web assets
   aws s3 sync --delete build $s3_path_base/web

   # copy cloudformation output
   mkdir src/cloudformation
   cdk synthesize --no-version-reporting --asset-metadata false --path-metadata false $APP_STACKS >src/cloudformation/main.yaml
   aws s3 sync --delete src/cloudformation $s3_path_base/cloudformation
fi
