#!/bin/bash
set -e
set -u
set -o pipefail

event_name=$GITHUB_EVENT_NAME
echo github event name $event_name

if [ "$event_name" = "pull_request" ]; then
   git_ref=$GITHUB_HEAD_REF
else
   git_ref=$GITHUB_REF
fi
echo git ref $git_ref

branch_name=$(echo $git_ref | sed -e 's/^refs\/heads\///')

if [ "$branch_name" = "main" ] || [ "$branch_name" = "master" ]; then
   tag=latest
else
   user_name=$(echo $GITHUB_ACTOR | sed -e 's/[^[:alnum:]]+/_/g')
   user_name=$(echo $user_name | sed -e 's/\(.*\)/\L\1/')
   tag=dev$user_name
fi

echo "Updating python lambda base image pointer for $tag"
param_name=/infra/python/lambda-image/$tag
param_value=953022346399.dkr.ecr.us-west-2.amazonaws.com/python-lambda:base-$GITHUB_SHA

echo "param name" $param_name
echo "param value" $param_value

aws ssm put-parameter --overwrite --type String --name $param_name --value "$param_value"
