#!/bin/bash

AWS_CREDENTIALS_FILE="$HOME/.aws/credentials"
AWS_CONFIG_FILE="$HOME/.aws/config"

mkdir -p "$HOME/.aws"

cat << EOF > $AWS_CREDENTIALS_FILE
[$AWS_PROD_PROFILE]
aws_access_key_id = $PROD_AWS_ACCESS_KEY
aws_secret_access_key = $PROD_AWS_SECRET_ACCESS_KEY

[$AWS_DEV_PROFILE]
aws_access_key_id = $DEV_AWS_ACCESS_KEY
aws_secret_access_key = $DEV_AWS_SECRET_ACCESS_KEY
EOF

cat << EOF > $AWS_CONFIG_FILE
[$AWS_PROD_PROFILE]
region = $AWS_REGION
output = json

[profile $AWS_DEV_PROFILE]
region = $DEV_AWS_REGION
output = json
EOF
