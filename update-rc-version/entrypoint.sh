#!/bin/bash
set -e
set -u
set -o pipefail

account_id=$(aws sts get-caller-identity --query Account --output text)
if [ "$account_id" != "953022346399" ]; then
   echo "invalid aws account, aborting"
   exit 1
fi

rc_version=$GITHUB_SHA

service_name=$GITHUB_REPOSITORY
service_name=$(echo $service_name | sed -e 's/^agwafarm\///')
service_name=$(echo $service_name | sed -e 's/^agwa\-//')

if [ "$service_name" = "cloud-components" ]; then
   service_name=cloud-parent
fi
if [ "$service_name" = "greengrass-service" ]; then
   service_name=greengrass-parent
fi

param_name=/infra/rc-version/$service_name
param_value=$(jq -n \
   --arg t "backend" \
   --arg v "$rc_version" \
   '{version: $v, type: $t}')

echo "Updating RC pointer"
echo "RC pointer name" $param_name
echo "RC pointer value" $param_value

aws ssm put-parameter --overwrite --type String --name $param_name --value "$param_value"
