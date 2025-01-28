import boto3
import json
import os
import sys
from subprocess import Popen
from time import sleep

mode = os.environ.get("APP_MODE", "service")
spec = json.loads(os.environ['APP_SPEC'])
edge_deployment = os.environ.get("APP_EDGE_DEPLOYMENT", "deploy_now")
env = spec.get('env')
services = spec.get('services')
service_names = [service['serviceName'] for service in services]
version = spec.get('version')
lambda_client = boto3.client('lambda')



if (mode == 'env' or ('greengrass-parent' in service_names and (env == 'ci'))) \
        and edge_deployment in ['deploy_tonight', 'deploy_now']:
    print(f'deploying greengrass definitions to devices in environment: {env}')
    payload = {"version_tag": version, "should_deploy_now": edge_deployment == 'deploy_now'}
    for i in range(5):
        try:
            response = lambda_client.invoke(
                FunctionName=f'{env}_devices_version_upgrader_lambda',
                InvocationType='RequestResponse',
                LogType='None',
                Payload=json.dumps(payload)
            )
            break
        except Exception as e:
            print(f'Could not invoke lambda: {e}. retrying...')
            sleep(10)
