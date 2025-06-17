import { ComponentResource, ComponentResourceOptions } from '@pulumi/pulumi'
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { assert } from 'console'

export type CronArgs = {
   name: string
   schedule: string
   target: pulumi.Output<string>
   enabled: boolean
}

export class Cron extends ComponentResource {
   private cron: aws.cloudwatch.EventRule | undefined
   private target: aws.cloudwatch.EventTarget | undefined

   constructor(name: string, args: CronArgs, opts?: ComponentResourceOptions) {
      super(`${name}-cron`, name, args, opts)
      this.registerOutputs({})
   }

   createCron(
      name: string,
      args: CronArgs,
      opts?: ComponentResourceOptions,
   ): this {
      this.cron = new aws.cloudwatch.EventRule(
         name,
         {
            scheduleExpression: args.schedule,
            name: `${name}-cron`,
         },
         opts,
      )

      return this
   }

   createTarget(
      name: string,
      args: CronArgs,
      opts?: ComponentResourceOptions,
   ): this {
      this,
         (this.target = new aws.cloudwatch.EventTarget(
            name,
            {
               rule: args.name,
               arn: args.target,
            },
            opts,
         ))

      return this
   }

   allowCronToInvokeLambda(
      name: string,
      args: CronArgs,
      opts?: ComponentResourceOptions,
   ): this {
      const policy = new aws.iam.Policy(
         name,
         {
            name,
            policy: JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Action: 'lambda:InvokeFunction',
                     Effect: 'Allow',
                     Resource: args.target,
                  },
               ],
            }),
         },
         opts,
      )

      return this
   }

   build(): aws.cloudwatch.EventRule {
      assert(this.cron, 'Cron not created yet')
      return this.cron!
   }
}
