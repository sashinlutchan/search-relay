import { ComponentResource, ComponentResourceOptions } from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { assert } from 'console'

export type CronArgs = {
   name: string
   schedule: string
   lambdaArn: aws.lambda.CallbackFunction<any, any>
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

   createCron(): this {
      this.cron = new aws.cloudwatch.EventRule(
         this.args.name,
         {
            description: this.args.description,
            scheduleExpression: this.args.schedule,
            name: this.args.name,
            isEnabled: this.args.enabled,
         },
         this.opts,
      )

      return this
   }

   createTarget(): this {
      if (!this.cron) {
         throw new Error('Cron rule must be created before target')
      }

      this.target = new aws.cloudwatch.EventTarget(
         this.args.name,
         {
            rule: this.cron.name,
            arn: this.args.lambdaArn.arn,
         },
         { ...this.opts, dependsOn: [this.cron] },
      )

      return this
   }

   allowCronToInvokeLambda(): this {
      if (!this.cron) {
         throw new Error('Cron rule must be created before permissions')
      }

      new aws.lambda.Permission(
         `${this.args.name}-permission`,
         {
            action: 'lambda:InvokeFunction',
            function: this.args.lambdaArn.name,
            principal: 'events.amazonaws.com',
            sourceArn: this.cron.arn,
         },
         { ...this.opts, dependsOn: [this.cron] },
      )

      return this
   }

   build(): aws.cloudwatch.EventRule {
      if (!this.cron) {
         throw new Error('Cron not created yet')
      }
      return this.cron
   }
}
