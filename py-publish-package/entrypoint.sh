#!/bin/bash

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
   package_version=0.0.1
else
   user_name=$(echo $GITHUB_ACTOR | sed -e 's/[^[:alnum:]]+/_/g')
   user_name=$(echo $user_name | sed -e 's/\(.*\)/\L\1/')
   package_version=0.0.1-alpha-$user_name
fi

export APP_CA_DOMAIN=agwafarm-private
export APP_CA_REPOSITORY=agwafarm-private
export APP_CA_DOMAIN_OWNER_ACCOUNT=953022346399

export CODEARTIFACT_REPOSITORY_URL=$(aws codeartifact get-repository-endpoint --domain $APP_CA_DOMAIN --domain-owner $APP_CA_DOMAIN_OWNER_ACCOUNT --repository $APP_CA_DOMAIN --format pypi --query repositoryEndpoint --output text)
echo $CODEARTIFACT_REPOSITORY_URL
export CODEARTIFACT_AUTH_TOKEN=$(aws codeartifact get-authorization-token --domain $APP_CA_DOMAIN --domain-owner $APP_CA_DOMAIN_OWNER_ACCOUNT --query authorizationToken --output text)
export CODEARTIFACT_USER=aws

aws codeartifact delete-package-versions --domain $APP_CA_DOMAIN --domain-owner $APP_CA_DOMAIN_OWNER_ACCOUNT --repository $APP_CA_REPOSITORY --format pypi --package $agwa-lib --versions $package_version

# do not fail if delete package version fails - set fail flags only after that.
set -e
set -u
set -o pipefail

poetry config repositories.private $CODEARTIFACT_REPOSITORY_URL
poetry config http-basic.private $CODEARTIFACT_USER $CODEARTIFACT_AUTH_TOKEN

poetry version $package_version
poetry publish --build -r private
