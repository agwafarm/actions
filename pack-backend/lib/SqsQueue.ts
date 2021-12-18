import * as cdk from "@aws-cdk/core";
import * as sqs from "@aws-cdk/aws-sqs";
import * as cwa from "@aws-cdk/aws-cloudwatch-actions";
import * as sns from "@aws-cdk/aws-sns";

import { BaseStack, BaseConstruct } from "./base";

export interface SqsQueueProps {
   /**
    * queue name
    */
   queueName: string;
   /**
    * maximum amount of retries before message is delivered to the dlq
    */
   maxRetries: number;
}

/**
 * Defines an SQS queue, a dead letter queue and an alarm on the dead letter queue.
 */
export class SqsQueue extends BaseConstruct {
   readonly instance: sqs.Queue;
   readonly dlq: sqs.Queue;
   readonly name: string;

   constructor(scope: BaseStack, id: string, props: SqsQueueProps) {
      super(scope, id);

      const queueName = this.resolveSqsQueueName(props.queueName);
      const dlqueueName = `dlq${queueName}`;
      const dlq = new sqs.Queue(this, `DLQueue`, {
         queueName: dlqueueName,
         retentionPeriod: cdk.Duration.days(4),
      });

      this.dlq = dlq;
      const errorTopicArn = this.getErrorSnsTopicArn();
      const topic = sns.Topic.fromTopicArn(
         this,
         `ErrorTopicRef`,
         errorTopicArn
      );

      dlq.metricNumberOfMessagesSent({
         statistic: "sum",
         label: "Number of Messages in DLQ",
      })
         .createAlarm(this, `DLQAlarm`, {
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: `SNS Alarm for ${dlqueueName} DLQ Message count`,
            alarmName: `${dlqueueName}Alarm`,
         })
         .addAlarmAction(new cwa.SnsAction(topic));

      this.instance = new sqs.Queue(this, `Queue`, {
         queueName: this.resolveSqsQueueName(queueName),
         receiveMessageWaitTime: cdk.Duration.seconds(20),
         deadLetterQueue: {
            maxReceiveCount: props.maxRetries,
            queue: dlq,
         },
      });

      this.name = this.instance.queueName;
   }
}
