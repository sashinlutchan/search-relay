import { EventSourceMappingArgs } from '@pulumi/aws/lambda'
import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import assert = require('assert')
export class EventSourceMapping extends pulumi.ComponentResource {
   private args: EventSourceMappingArgs
   private name: string
   private tableName: string
   public mapping!: aws.lambda.EventSourceMapping

   constructor(name: string, tableName: string, args: EventSourceMappingArgs) {
      super(`${name}-${tableName}-event-source-mapping`, name)
      this.args = {
         ...args,
         enabled: args.enabled ?? true,
         batchSize: args.batchSize ?? 10,
         functionResponseTypes: ['ReportBatchItemFailures'],
         scalingConfig: {
            maximumConcurrency: 2,
         },
      }
      this.name = name
      this.tableName = tableName
      this.registerOutputs({})
   }

   createSourceMapping(): this {
      this.mapping = new aws.lambda.EventSourceMapping(
         `${this.name}-${this.tableName}`,
         this.args,
         {
            parent: this,
            deleteBeforeReplace: true,
         },
      )
      return this
   }

   build(): aws.lambda.EventSourceMapping {
      assert(this.mapping, 'Mapping not created yet')
      return this.mapping
   }
}
