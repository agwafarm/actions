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

user_name=$(echo $GITHUB_ACTOR | sed -e 's/[^[:alnum:]]+/_/g')
user_name=$(echo $user_name | sed -e 's/\(.*\)/\L\1/')

if [ "$branch_name" = "main" ] || [ "$branch_name" = "master" ]; then
   s3_retainment=standard
   target_env=ci
else
   s3_retainment=low
   target_env=dev$user_name
fi

# prepare CDK variables
export APP_BUCKET=$target_env-agwa-$service_name
echo app bucket $APP_BUCKET

export APP_ENV=$target_env
export APP_SERVICE=$service_name

export APP_BUCKET_PREFIX=$rc_version
export APP_COMPANY_NAME=agwa
export APP_STACK=$target_env-$service_name
echo app stack $APP_STACK

# deploy the ci / dev environment resources
export APP_STACKS=$(cdk list)
cdk deploy --require-approval never $APP_STACKS --parameters Environment=$target_env --parameters BucketName=$APP_BUCKET --parameters IndexPath='index.html'

# compute build arguments
npx ts-node --prefer-ts-exts ./compute-build-args.ts
set -o allexport
source ./buildargs.$target_env
set +o allexport

# build
npm run build

# copy build to bucket for ci / dev environment
aws s3 sync --delete build s3://$APP_BUCKET
aws s3 sync --delete build s3_path_base/web/$build_env

# on merge
# persist cloudformation output as deployable frontend
# build and persist web assets for all environments (used later in deployment and post deployment stage)
if [ "$s3_retainment" = "standard" ]; then
   s3_path_base=s3://agwa-ci-assets/$s3_retainment/$service_name/$rc_version

   # copy cloudformation output
   mkdir src/cloudformation
   cdk synthesize --no-version-reporting --asset-metadata false --path-metadata false $APP_STACKS >src/cloudformation/main.yaml
   aws s3 sync --delete src/cloudformation $s3_path_base/cloudformation

   # build for all envs so that deploy to env workflow succeeds.
   # TODO discuss dilemma - deploying prod / test to dev$user of all developers will no longer work, since they will not have this specific version
   # The below is a patch for now
   # TODO add isaac
   declare -a arr=("test" "prod" "dev" "deveyalperry" "devnivsto")

   for build_env in "${arr[@]}"; do
      export APP_ENV=$build_env

      # apply build arguments to environment
      npx ts-node --prefer-ts-exts ./compute-build-args.ts
      echo "build arguments for env $build_env"
      cat ./buildargs.$build_env

      set -o allexport
      source ./buildargs.$build_env
      set +o allexport

      rm -rf build
      npm run build

      aws s3 sync --delete build s3_path_base/web/$build_env
   done

   # update RC pointer
   param_name=/infra/rc-version/$service_name
   param_value="{\"version\":\"$rc_version\", \"type\":\"frontend\"}"

   echo ssm param name $param_name
   echo ssm param value $param_value

   aws ssm put-parameter --type String --overwrite --name $param_name --value $param_value --tags Key=type,Value=$app_type
fi
