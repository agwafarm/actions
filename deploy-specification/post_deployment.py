import os
import json

mode = os.environ.get("APP_MODE", "service");
spec = json.loads(os.environ['APP_SPEC'])
env = spec.get('env')
services = spec.get('services')
service_names = [service['serviceName'] for service in services]

if mode == 'env' or 'greengrass-parent' in service_names:
    print(f'deploying greengrass definitions to devices in environment: {env}')
    os.environ['AGWA_SERVICE_LIBRARY_TAG'] = 'latest'
    os.system(f'py-prepare.sh')
    os.system(f'python3 gg_deploy.py -e {env}')