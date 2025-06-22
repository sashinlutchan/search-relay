import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { assert } from 'console'

export class Lambda extends pulumi.ComponentResource {
   private name: string
   private stage: string
   public lambda!: aws.lambda.CallbackFunction<any, any>
   private lambdaRole!: aws.iam.Role
   private sqsPolicy!: aws.iam.Policy
   private defaultArgs!: aws.lambda.CallbackFunctionArgs<any, any>
   private secretsManagerPolicy!: aws.iam.Policy
   private region: string

   constructor(
      name: string,
      region: string,
      stage: string,
      defaultArgs: aws.lambda.CallbackFunctionArgs<any, any>,
   ) {
      super(`${name}-lambda`, name)
      this.name = name
      this.stage = stage
      this.region = region
      this.defaultArgs = defaultArgs
   }

   createLambda(
      stage: string,
      handler: any,
      reservedConcurrentExecutions?: number,
   ): this {
      const concurrency =
         reservedConcurrentExecutions && reservedConcurrentExecutions !== null
            ? undefined
            : reservedConcurrentExecutions

      this.lambda = new aws.lambda.CallbackFunction(`${stage}-${this.name}`, {
         name: `${stage}-${this.name}`,
         ...this.defaultArgs,
         callback: handler,
         role: this.lambdaRole.arn,
         ...(concurrency && { reservedConcurrentExecutions: concurrency }),
      })

      return this
   }

   createRole(stage: string, roleName: string): this {
      this.lambdaRole = new aws.iam.Role(`${stage}-${roleName}`, {
         name: `${stage}-${roleName}`,
         assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
               {
                  Action: 'sts:AssumeRole',
                  Effect: 'Allow',
                  Principal: {
                     Service: 'lambda.amazonaws.com',
                  },
               },
            ],
         }),
         tags: {
            Stage: stage,
         },
      })

      return this
   }

   grantBasicExecution(): this {
      new aws.iam.RolePolicy(`${this.stage}-${this.name}-basic-execution`, {
         role: this.lambdaRole.id,
         policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
               {
                  Effect: 'Allow',
                  Action: [
                     'logs:CreateLogGroup',
                     'logs:CreateLogStream',
                     'logs:PutLogEvents',
                  ],
                  Resource: '*',
               },
            ],
         }),
      })

      return this
   }


   createSqsPolicy(stage: string, name: string): this {
      this.sqsPolicy = new aws.iam.Policy(
         `${stage}-${name}-sqs-access-policy`,
         {
            description: 'Policy for Lambda to access SQS queues',
            policy: JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Effect: 'Allow',
                     Action: [
                        'sqs:ReceiveMessage',
                        'sqs:DeleteMessage',
                        'sqs:GetQueueAttributes',
                     ],
                     Resource: '*',
                  },
               ],
            }),
         },
      )

      new aws.iam.RolePolicyAttachment(
         `${stage}-${name}-sqs-policy-attachment`,
         {
            role: this.lambdaRole.name,
            policyArn: this.sqsPolicy.arn,
         },
      )

      return this
   }

   createOpensearchPolicy(stage: string, policyName: string): this {
      new aws.iam.RolePolicy(`${stage}-${this.name}-${policyName}-opensearch`, {
         role: this.lambdaRole.id,
         policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
               {
                  Effect: 'Allow',
                  Action: [
                     'es:ESHttpGet',
                     'es:ESHttpPut',
                     'es:ESHttpPost',
                     'es:ESHttpDelete',
                     'es:ESHttpHead',
                     'es:ESHttpAny',
                  ],
                  Resource: "*",
               },
            ],
         }),
      })

      return this
   }

   build() {
      assert(this.lambdaRole, 'Lambda role must be created before build')
      assert(this.lambda, 'Lambda must be created before build')
      return {
         lambdaRole: this.lambdaRole,
         lambda: this.lambda,
      }
   }
}
