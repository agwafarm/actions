#!/bin/bash
set -e
set -u
set -o pipefail

export AWS_DEV_PROFILE=dev
export AWS_PROD_PROFILE=default
export AWS_PROFILE=$AWS_DEV_PROFILE
sh /action/build-aws-profile.sh

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
   lower_case_github_actor=$(echo $GITHUB_TRIGGERING_ACTOR | tr '[:upper:]' '[:lower:]')
   target_env="dev${lower_case_github_actor}"
fi
echo s3 retainment $s3_retainment
echo target env $target_env

export APP_COMPANY_NAME=agwa

export APP_SERVICE=$service_name
echo app service $APP_SERVICE

export APP_BUCKET=$target_env-agwa-$service_name
echo app bucket $APP_BUCKET

export ROUTING_DOMAIN=$target_env-$service_name.agwafarm.com
echo routing domain $ROUTING_DOMAIN

export APP_ENV=$target_env
echo app env $APP_ENV

export APP_STACK=$target_env-$service_name
echo app stack $APP_STACK

account_id=$(aws sts get-caller-identity --query Account --output text)
export ACCOUNT_ID=$account_id
echo account id $ACCOUNT_ID

# deploy the ci / dev environment resources
export APP_STACKS=$(cdk list)
cdk deploy --require-approval never $APP_STACKS --parameters Environment=$target_env --parameters BucketName=$APP_BUCKET --parameters IndexPath='index.html' --parameters NotFoundPath='/index.html' --parameters RoutingDomain=$ROUTING_DOMAIN

# compute build arguments
npx ts-node --prefer-ts-exts /action/compute-build-args.ts
set -o allexport
source /github/workspace/buildargs.$target_env
set +o allexport

# switch to repo folder
cd /github/workspace

# build
# Disable linting during builds - this is done in workflows
# We need to save time on our four builds during merge
export DISABLE_ESLINT_PLUGIN=true
export NODE_OPTIONS="--max-old-space-size=8192"
export GENERATE_SOURCEMAP=false
npm run build

# copy build to bucket for ci / dev environment
aws s3 sync --no-progress --delete build s3://$APP_BUCKET

# on merge
# persist cloudformation output as deployable frontend
# build and persist web assets for all environments (used later in deployment and post deployment stage)
if [ "$s3_retainment" = "standard" ]; then
   export AWS_PROFILE=$AWS_PROD_PROFILE

   account_id=$(aws sts get-caller-identity --query Account --output text)
   export ACCOUNT_ID=$account_id
   echo account id $ACCOUNT_ID
   
   s3_path_base=s3://agwa-ci-assets/$s3_retainment/$service_name/$rc_version

   # copy cloudformation output
   cd /action
   mkdir cloudformation
   cdk synthesize --no-version-reporting --asset-metadata false --path-metadata false $APP_STACKS >cloudformation/main.yaml
   aws s3 sync --no-progress --delete cloudformation $s3_path_base/cloudformation

   cd /github/workspace

   # build for all envs so that deploy to env workflow succeeds.
   # TODO remove this loop once we can resolve env variables at runtime using lambda @ edge
   # The below is a patch for now
   # dev must also be here since merge sha is different than PR sha.
   declare -a arr=("dev" "test" "prod")

   for build_env in "${arr[@]}"; do
      cd /action

      export APP_ENV=$build_env

      export APP_BUCKET=$APP_ENV-agwa-$service_name
      echo app bucket $APP_BUCKET

      if [ "$APP_ENV" = "prod" ]; then
         export ROUTING_DOMAIN=$service_name.agwafarm.com
         echo routing domain $ROUTING_DOMAIN
      else
         export ROUTING_DOMAIN=$APP_ENV-$service_name.agwafarm.com
         echo routing domain $ROUTING_DOMAIN
      fi

      export APP_STACK=$APP_ENV-$service_name
      echo app stack $APP_STACK

      export APP_STACKS=$(cdk list)
      cdk deploy --require-approval never $APP_STACKS --parameters Environment=$APP_ENV --parameters BucketName=$APP_BUCKET --parameters IndexPath='index.html' --parameters NotFoundPath='/index.html' --parameters RoutingDomain=$ROUTING_DOMAIN

      # apply build arguments to environment
      npx ts-node --prefer-ts-exts /action/compute-build-args.ts
      echo "build arguments for env $build_env"

      set -o allexport
      source /github/workspace/buildargs.$build_env
      set +o allexport

      cd /github/workspace

      rm -rf build
      npm run build

      aws s3 sync --no-progress --delete build $s3_path_base/web/$build_env
   done

   # update RC pointer
   param_name=/infra/rc-version/$service_name
   param_value=$(jq -n \
      --arg t "frontend" \
      --arg v "$rc_version" \
      '{version: $v, type: $t}')

   echo "Updating RC pointer"
   echo "RC pointer name" $param_name
   echo "RC pointer value" $param_value

   aws ssm put-parameter --overwrite --type String --name $param_name --value "$param_value"

fi
