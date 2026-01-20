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

is_greengrass_ci_dev_deployment = 'greengrass-parent' in service_names and (env == 'ci' or env.startswith("dev"))

if is_greengrass_ci_dev_deployment or (mode == 'env' and edge_deployment != 'skip'):
    print(f'deploying greengrass definitions to devices in environment: {env}')
    payload = {"version_tag": version, "should_deploy_now": edge_deployment == 'deploy_now'}
    
    if is_greengrass_ci_dev_deployment:
        payload["skip_tracking"] = True

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
