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

# echo "[$AWS_PROD_PROFILE]" >> $AWS_CREDENTIALS_FILE
# echo "aws_access_key_id = $PROD_AWS_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE
# echo "aws_secret_access_key = $PROD_AWS_SECRET_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE
# echo "" >> $AWS_CREDENTIALS_FILE
# echo "[$AWS_DEV_PROFILE]" >> $AWS_CREDENTIALS_FILE
# echo "aws_access_key_id = $DEV_AWS_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE
# echo "aws_secret_access_key = $DEV_AWS_SECRET_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE

# echo "[$AWS_PROD_PROFILE]" >> $AWS_CONFIG_FILE
# echo "region = $AWS_REGION" >> $AWS_CONFIG_FILE
# echo "output = json" >> $AWS_CONFIG_FILE
# echo ""
# echo "[profile $AWS_DEV_PROFILE]" >> $AWS_CONFIG_FILE
# echo "region = $DEV_AWS_REGION" >> $AWS_CONFIG_FILE
# echo "output = json" >> $AWS_CONFIG_FILE

cat $AWS_CREDENTIALS_FILE
cat $AWS_CONFIG_FILE
aws sts get-caller-identity
