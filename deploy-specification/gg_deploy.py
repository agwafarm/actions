import argparse
import json
import logging
import os
import sys
from time import sleep
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
TIMEOUT_IN_MINUTES = 10 if args.env == 'prod' else 5

# TODO: Change this list to be read from an SSM parameter
non_upgradable_devices = [265, 266, 267]


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
        group_id = user_device["groupId"]
        if int(user_device["deviceId"]) in non_upgradable_devices:
            logger.info(f"Skipping device {device['deviceId']} because it is not upgradable.")
            continue
        if not controller_id:
            continue
        try:
            deployment_id = upgrade_controller(controller_id)
            device_deployments.append((controller_id, group_id, deployment_id))
        except Exception as e:
            logger.error(f"{e}")
            device_deployments.append((controller_id, group_id, None))
    logger.info("Finished requesting upgrade for all devices.")
    return device_deployments


def track_deployments(device_deployments):
    success_deployments = []
    failed_deployments = [device_deployment for device_deployment in device_deployments if device_deployment[2] is None]
    waiting_deployments = [device_deployment for device_deployment in device_deployments if device_deployment[2] is not None]
    counter = TIMEOUT_IN_MINUTES
    client = boto3.client('greengrass')
    while len(waiting_deployments) > 0 and counter > 0:
        sleep(60)
        temp_waiting_deployments = []
        for device_deployment in waiting_deployments:
            try:
                response = client.get_deployment_status(
                    DeploymentId=device_deployment[2],
                    GroupId=device_deployment[1]
                )
                if response.get("DeploymentStatus") == "Success":
                    logger.info(f"Successfully deployed controller {device_deployment[0]}.")
                    success_deployments.append(device_deployment)
                elif response.get("DeploymentStatus") == "Failure":
                    logger.info(f"Deployment of {device_deployment[0]} has failed.")
                    failed_deployments.append(device_deployment)
                else:
                    temp_waiting_deployments.append(device_deployment)
            except Exception as e:
                logger.error(f'failed to get deployment status for controller {device_deployment[0]} (deployment id:{device_deployment[2]})')
                logger.exception(e)

        waiting_deployments = temp_waiting_deployments
        counter -= 1

    logger.info(f"{len(success_deployments)} devices were upgraded successfully. devices: {[device_deployment[0] for device_deployment in success_deployments]}")
    logger.info(f"{len(failed_deployments)} devices were failed to upgrade. devices: {[device_deployment[0] for device_deployment in failed_deployments]}")
    logger.info(f"{len(waiting_deployments)} devices are still in progress. devices: {[device_deployment[0] for device_deployment in waiting_deployments]}")


def main():
    logger.info(f"Upgrading active controllers in {os.environ['ENV']} env.")
    devices = upgrade_devices()
    logger.info(f"{len(devices)} device upgrades were requested.")
    if devices:
        track_deployments(devices)


if __name__ == '__main__':
    main()
