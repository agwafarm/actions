import os
import json
import sys

from subprocess import Popen
mode = os.environ.get("APP_MODE", "service");
spec = json.loads(os.environ['APP_SPEC'])
env = spec.get('env')

# we do not deploy to dev branches automatically since mysql lists all dev devices in one database.
# this means automatically deploying breaks when all devices are deployed to a specific env
if mode == 'env' or env == 'ci':
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