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

if mode == 'env' or ('greengrass-parent' in service_names and env == 'ci') and edge_deployment == 'deploy':
    print(f'deploying greengrass definitions to devices in environment: {env}')
    os.environ['AGWA_SERVICE_LIBRARY_TAG'] = 'latest'
    prepare = Popen(["./py-prepare.sh"])
    prepare.wait()
    if prepare.poll():
        sys.exit(1)
    
    deploy = Popen(["python3", "gg_deploy.py", "-e", env])
    deploy.wait()
    if deploy.poll():
        sys.exit(1)
