import argparse
import json
import logging
import os
import sys
from typing import List, Tuple, Optional
import boto3
from agwa_data_layer import device

logger = logging.getLogger()
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)

parser = argparse.ArgumentParser()
parser.add_argument("-e", "--env", action="store", dest="env", help="Environment name to use")
args = parser.parse_args()

os.environ["ENV"] = args.env  # CHANGE According to the relevant env
TIMEOUT_IN_MINUTES = 10


def upgrade_controller(controller_id: str) -> str:
    client = boto3.client('lambda')
    payload = {
        "httpMethod": "PUT",
        "pathParameters":
            {"controller_id": controller_id}
    }
    response = client.invoke(
        FunctionName=f'{os.environ["ENV"]}_controller_management',
        InvocationType='RequestResponse',
        LogType='None',
        Payload=json.dumps(payload)
    )
    if response['StatusCode'] != 200:
        raise ValueError(f"Unsuccessfully called upgrade API for controller {controller_id}. status code: {response['StatusCode']}")
    response_payload = json.loads(response['Payload'].read())
    if response_payload.get('statusCode') != 200:
        raise ValueError(f"Upgrading controller {controller_id} failed. status code: {response_payload.get('statusCode')}")
    response_body = json.loads(response_payload['body'])
    return response_body["deployment_id"]


def upgrade_devices() -> List[Tuple[str, Optional[str]]]:
    device_deployments = []
    devices_to_upgrade = device.get_all_user_devices()
    logger.info(f"Found {len(list(devices_to_upgrade))} devices to upgrade.")
    for user_device in devices_to_upgrade:
        controller_id = user_device["controllerId"]
        try:
            deployment_id = upgrade_controller(controller_id)
            device_deployments.append((controller_id, deployment_id))
        except Exception as e:
            logger.error(f"{e}")
            device_deployments.append((controller_id, None))
    logger.info("Finished requesting upgrade for all devices.")
    return device_deployments

def main():
    logger.info(f"Upgrading active controllers in {os.environ['ENV']} env.")
    devices = upgrade_devices()
    logger.info(f"{len(devices)} device upgrades were requested.")


if __name__ == '__main__':
    main()
