import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import assert = require('assert')
import { Table } from '@pulumi/aws/dynamodb'

export class Sqs extends pulumi.ComponentResource {
   private queue: aws.sqs.Queue | undefined
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

   createQueue(
      queueName: string,
      appName: string,
      visibilityTimeout: number = 30,
   ): Sqs {
      this.queue = new aws.sqs.Queue(`${appName}-${queueName}`, {
         name: `${appName}-${queueName}`,
         visibilityTimeoutSeconds: visibilityTimeout,
         messageRetentionSeconds: 60 * 60 * 24 * 7,
      })
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

   build(): aws.sqs.Queue {
      assert(this.queue, 'Queue not created yet')
      return this.queue
   }
}
