#!/bin/bash

AWS_CREDENTIALS_FILE="$HOME/.aws/credentials"
AWS_CONFIG_FILE="$HOME/.aws/config"

mkdir -p "$HOME/.aws"

echo "[$AWS_PROD_PROFILE]" >> $AWS_CREDENTIALS_FILE
echo "aws_access_key_id = $PROD_AWS_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE
echo "aws_secret_access_key = $PROD_AWS_SECRET_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE
echo "" >> $AWS_CREDENTIALS_FILE
echo "[$AWS_DEV_PROFILE]" >> $AWS_CREDENTIALS_FILE
echo "aws_access_key_id = $DEV_AWS_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE
echo "aws_secret_access_key = $DEV_AWS_SECRET_ACCESS_KEY" >> $AWS_CREDENTIALS_FILE

echo "[$AWS_PROD_PROFILE]" >> $AWS_CONFIG_FILE
echo "region = $AWS_REGION" >> $AWS_CONFIG_FILE
echo "output = json" >> $AWS_CONFIG_FILE
echo ""
echo "[profile $AWS_DEV_PROFILE]" >> $AWS_CONFIG_FILE
echo "region = $DEV_AWS_REGION" >> $AWS_CONFIG_FILE
echo "output = json" >> $AWS_CONFIG_FILE
