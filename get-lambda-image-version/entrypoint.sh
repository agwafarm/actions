#!/bin/bash
set -e
set -u
set -o pipefail

param_value=$GITHUB_SHA

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
   tag=latest
else
   user_name=$(echo $GITHUB_ACTOR | sed -e 's/[^[:alnum:]]+/_/g')
   user_name=$(echo $user_name | sed -e 's/\(.*\)/\L\1/')
   echo user name $user_name
   tag=dev$user_name
fi

echo "Getting python lambda base image pointer for $tag"
echo "RC pointer name" $param_name
echo "RC pointer value" $param_value

param_name=/infra/python/lambda-image/$tag
tag_value=$(aws ssm get-parameter --name $param_name | jq '.Parameter.Value')
echo "::set-output name=tag::$tag_value"
