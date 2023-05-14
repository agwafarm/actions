import os
import json
import sys

from subprocess import Popen
mode = os.environ.get("APP_MODE", "service")
spec = json.loads(os.environ['APP_SPEC'])
edge_deployment = os.environ.get("APP_EDGE_DEPLOYMENT", "deploy")
env = spec.get('env')
services = spec.get('services')
service_names = [service['serviceName'] for service in services]
version = spec.get('version')

if (mode == 'env' or ('greengrass-parent' in service_names and env == 'ci')) and edge_deployment == 'deploy':
    print(f'deploying greengrass definitions to devices in environment: {env}')
    payload = {"version_tag": version}
    response = client.invoke(
        FunctionName=f'{env}_devices_version_upgrader_lambda',
        InvocationType='RequestResponse',
        LogType='None',
        Payload=json.dumps(payload)
    )
