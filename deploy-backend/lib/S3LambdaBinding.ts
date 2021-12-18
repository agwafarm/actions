import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as iam from "@aws-cdk/aws-iam";
import * as s3n from "@aws-cdk/aws-s3-notifications";

import { BucketFactory, S3Bucket } from "./S3Bucket";
import { SqsQueue } from "./SqsQueue";

import { S3LambdaTriggers, S3LambdaTrigger } from "./types";
import { BaseConstruct, BaseStack } from "./base";

export interface S3LambdaBindingProps {
   functionName?: string;
   triggers: S3LambdaTriggers;
   fn: lambda.IFunction;
   bucketFactory: BucketFactory;
}

/**
 * Binds Lambda To S3 Events via SQS.
 */
export class S3LambdaBinding extends BaseConstruct {
   readonly bucketTriggers: ReadonlyArray<[S3LambdaTrigger, S3Bucket]>;
   constructor(scope: BaseStack, id: string, props: S3LambdaBindingProps) {
      super(scope, id);

      const queueName = `${props.functionName}-s3`;
      const queue = new SqsQueue(scope, `${queueName}S3Queue`, {
         queueName,
         maxRetries: props.triggers.maxRetries,
      });

      props.fn.grantInvoke(new iam.ServicePrincipal("sqs.amazonaws.com"));

      //CDK lambda event source package wrapper for SQS does not support batch sizes of more than 10 and does not support batch window (they only support fifo),
      //fortunately, it is just an oversight in the wrapper implementation- not the underlying infra.
      //so we copy over their binding code
      //TODO replace with SqsEventSource usage when they merge regular queue support
      //https://github.com/aws/aws-cdk/blob/c506d3ba357025e81da97ec594be9f3948a2f07c/packages/%40aws-cdk/aws-lambda-event-sources/lib/sqs.ts#L28
      //https://github.com/aws/aws-cdk/blob/c506d3ba357025e81da97ec594be9f3948a2f07c/packages/%40aws-cdk/aws-lambda/lib/function-base.ts#L343

      props.fn.addEventSourceMapping(`${queueName}SqsEventSource`, {
         batchSize: 10,
         maxBatchingWindow: cdk.Duration.minutes(5),
         eventSourceArn: queue.instance.queueArn,
      });

      const destination = new s3n.SqsDestination(queue.instance);
      queue.instance.grantConsumeMessages(props.fn);
      // END OF COPIED OVER CODE

      this.bucketTriggers = props.triggers.items.map(
         (s3Trigger: S3LambdaTrigger) => {
            const bucket = props.bucketFactory.createOrGetBucket(
               s3Trigger.bucketProps
            );
            s3Trigger.eventTypes.forEach((eventType) => {
               bucket.instance.addEventNotification(eventType, destination);
            });

            return [s3Trigger, bucket];
         }
      );
   }
}
