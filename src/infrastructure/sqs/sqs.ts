import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import assert = require('assert')
import { Table } from '@pulumi/aws/dynamodb'

export class Sqs extends pulumi.ComponentResource {
   private queue: aws.sqs.Queue | undefined
   private dlq: aws.sqs.Queue | undefined
   private stage: string
   private resourceName: string

   constructor(name: string, stage: string) {
      super('SQSQueue', name)
      this.resourceName = name
      this.stage = stage
      this.registerOutputs({})
   }

   get getQueue(): aws.sqs.Queue {
      assert(this.queue, 'Queue not created yet')
      return this.queue
   }

   get getDLQ(): aws.sqs.Queue | undefined {
      return this.dlq
   }

  

   createQueue(
      queueName: string,
      appName: string,
      visibilityTimeout: number = 30,
      maxReceiveCount: number = 3,
   ): Sqs {
      const redrivePolicy = this.dlq ? {
         deadLetterTargetArn: this.dlq.arn,
         maxReceiveCount: maxReceiveCount,
      } : undefined

      this.queue = new aws.sqs.Queue(`${appName}-${queueName}`, {
         name: `${appName}-${queueName}`,
         visibilityTimeoutSeconds: visibilityTimeout,
         messageRetentionSeconds: 60 * 60 * 24 * 7,
         redrivePolicy: redrivePolicy ? this.dlq!.arn.apply(arn => JSON.stringify({
            deadLetterTargetArn: arn,
            maxReceiveCount: maxReceiveCount,
         })) : undefined,
         tags: {
            Purpose: 'Main Queue',
            Environment: this.stage,
         },
      }, this.dlq ? {dependsOn: [this.dlq]} : {})
      return this
   }

   createEventPipePolicy(table: Table): this {
      assert(this.queue, 'Queue not created yet')
      new aws.sqs.QueuePolicy(
         `${this.stage}-${this.resourceName}-queue-policy`,
         {
            queueUrl: this.queue.url,
            policy: pulumi
               .all([this.queue.arn, table.streamArn])
               .apply(([qArn, sArn]) =>
                  JSON.stringify({
                     Version: '2012-10-17',
                     Statement: [
                        {
                           Effect: 'Allow',
                           Principal: {
                              Service: 'pipes.amazonaws.com',
                           },
                           Action: 'sqs:SendMessage',
                           Resource: qArn,
                           Condition: {
                              ArnEquals: {
                                 'aws:SourceArn': sArn,
                              },
                           },
                        },
                     ],
                  }),
               ),
         },
         { parent: this, dependsOn: [table] },
      )
      return this
   }
   createDLQ(queueName: string, appName: string): this {
      this.dlq = new aws.sqs.Queue(`${appName}-${queueName}-dlq`, {
         name: `${appName}-${queueName}-dlq`,
         messageRetentionSeconds: 60 * 60 * 24 * 14,
         tags: {
            Purpose: 'Dead Letter Queue',
            Environment: this.stage,
         },
      })
      return this
   }
   createDLQPolicy(): this {
      if (!this.dlq) {
         return this
      }

      new aws.sqs.QueuePolicy(
         `${this.stage}-${this.resourceName}-dlq-policy`,
         {
            queueUrl: this.dlq.url,
            policy: JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Effect: 'Allow',
                     Principal: {
                        Service: 'sqs.amazonaws.com',
                     },
                     Action: 'sqs:SendMessage',
                     Resource: this.dlq.arn,
                  },
               ],
            }),
         },
         { parent: this, dependsOn: [this.dlq] },
      )
      return this
   }

   build(): { queue: aws.sqs.Queue; dlq?: aws.sqs.Queue } {
      assert(this.queue, 'Queue not created yet')
      assert(this.dlq, 'DLQ not created yet')

      return {
         queue: this.queue,
         dlq: this.dlq,
      }
   }
}
