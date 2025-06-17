import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as assert from 'assert'
import { Table } from '@pulumi/aws/dynamodb'

export class EventPipe extends pulumi.ComponentResource {
   private stage: string
   private name: string
   private pipeRole!: aws.iam.Role
   private pipe!: aws.pipes.Pipe

   constructor(name: string, stage: string) {
      super(`${name}-pipe`, `${name}-pipe`, {})
      this.stage = stage
      this.name = name
   }

   getPipe(): aws.pipes.Pipe {
      return this.pipe
   }

   createPipe(table: Table, queueArn: pulumi.Output<string> | undefined): this {
      assert(table.streamArn, 'streamArn is required')
      assert(queueArn, 'queueArn is required')

      this.pipe = new aws.pipes.Pipe(
         `${this.stage}-${this.name}-pipe`,
         {
            name: `${this.stage}-${this.name}-pipe`,
            roleArn: this.pipeRole.arn,
            source: table.streamArn || '',
            target: queueArn || '',
            sourceParameters: {
               dynamodbStreamParameters: {
                  startingPosition: 'LATEST',
                  batchSize: 10,
               },
            },
            targetParameters: {
               sqsQueueParameters: {},
            },
            tags: {
               Stage: this.stage,
               Purpose: `${this.name}-pipe-sqs`,
            },
         },
         { dependsOn: [table] },
      )

      return this
   }

   createRole(): this {
      this.pipeRole = new aws.iam.Role(
         `${this.stage}-${this.name}-to-sqs-pipe-role`,
         {
            name: `${this.stage}-${this.name}-to-sqs-pipe-role`,
            assumeRolePolicy: JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Action: 'sts:AssumeRole',
                     Effect: 'Allow',
                     Principal: {
                        Service: 'pipes.amazonaws.com',
                     },
                  },
               ],
            }),
            tags: {
               Stage: this.stage,
            },
         },
      )

      return this
   }

   createPolicy(
      table: Table,
      queueArn: pulumi.Output<string> | undefined,
   ): this {
      assert(table.streamArn, 'streamArn is required')
      assert(queueArn, 'queueArn is required')

      const policy = pulumi
         .all([table.streamArn, queueArn])
         .apply(([stream, queue]) => {
            return JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Effect: 'Allow',
                     Action: [
                        'dynamodb:GetRecords',
                        'dynamodb:GetShardIterator',
                        'dynamodb:DescribeStream',
                        'dynamodb:ListStreams',
                     ],
                     Resource: stream,
                  },
                  {
                     Effect: 'Allow',
                     Action: ['sqs:SendMessage'],
                     Resource: queue,
                  },
               ],
            })
         })

      new aws.iam.RolePolicy(`${this.stage}-${this.name}-pipe-policy`, {
         role: this.pipeRole.id,
         policy: policy,
      })

      return this
   }
}
