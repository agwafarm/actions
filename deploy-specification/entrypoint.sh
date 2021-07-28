export APP_SPEC=$1
pwd
ls -la
stacks=$(cdk list)
echo deploying stacks $stacks
cdk deploy --require-approval never $stacks
