import { ComponentResource, ComponentResourceOptions } from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { assert } from 'console'

export type CronArgs = {
   name: string
   schedule: string
   lambdaArn:  aws.lambda.CallbackFunction<any, any>
   enabled: boolean
   description: string
   opts?: ComponentResourceOptions
}

export class Cron extends ComponentResource {
   private cron: aws.cloudwatch.EventRule | undefined
   private target: aws.cloudwatch.EventTarget | undefined
   private args: CronArgs
   private opts: ComponentResourceOptions

   constructor(name: string, stage: string, args: CronArgs, opts?: ComponentResourceOptions) {
      super(`${stage}-${name}-cron`, name, args, opts)
      this.args = args
      this.opts = opts || {}
      this.registerOutputs({})
   }

   createCron(
   ): this {
      this.cron = new aws.cloudwatch.EventRule(
         this.args.name,
         {
            description: this.args.description,
            scheduleExpression: this.args.schedule,
            name: `${this.args.name}-cron`,
         },
         this.opts,
      )

      return this
   }

   createTarget(
   ): this {
         this.target = new aws.cloudwatch.EventTarget(
            this.args.name,
            {
               rule: this.args.name,
               arn: this.args.lambdaArn.arn,
            },
            this.opts,
         )

      return this
   }

   allowCronToInvokeLambda(
   ): this {
     new aws.iam.Policy(
         this.args.name,
         {
            name: this.args.name,
            policy: JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Action: 'lambda:InvokeFunction',
                     Effect: 'Allow',
                     Resource: '*',
                  },
               ],
            }),
         },
         this.opts,
      )

      return this
   }

   build(): aws.cloudwatch.EventRule {
      assert(this.cron, 'Cron not created yet')
      return this.cron!
   }
}
