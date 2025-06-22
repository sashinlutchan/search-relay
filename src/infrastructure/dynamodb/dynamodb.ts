import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import assert = require('assert')
import { Table } from '@pulumi/aws/dynamodb'

export type DynamodbConfig = {
   enableStreams?: boolean
   tableName: string
}

export class Dynamodb extends pulumi.ComponentResource {
   private resourceName: string
   private stage: string
   private table: Table | undefined

   constructor(name: string, stage: string) {
      super(`${stage}-${name}-dynamodb`, `${name}-${stage}`)
      this.resourceName = name
      this.stage = stage
      this.registerOutputs({})
   }

   createTable(config: DynamodbConfig): this {
      const tableName = config.tableName.toUpperCase()

      this.table = new aws.dynamodb.Table(
         `${tableName}-${this.stage}-dynamodb-table`,
         {
            name: tableName,
            billingMode: 'PAY_PER_REQUEST',
            attributes: [
               {
                  name: 'pk',
                  type: 'S',
               },
               {
                  name: 'sk',
                  type: 'S',
               },
            ],
            hashKey: 'pk',
            rangeKey: 'sk',
            streamEnabled: config.enableStreams,
            streamViewType: config.enableStreams
               ? 'NEW_AND_OLD_IMAGES'
               : undefined,
            tags: {
               Environment: this.stage,
               Name: tableName,
            },
         },
         { parent: this },
      )

      return this
   }
   build(): aws.dynamodb.Table {
      assert(this.table, 'Table not created yet')
      return this.table
   }

   getTable(tableName: string): Table {
      this.table = aws.dynamodb.Table.get(tableName, tableName)
      return this.table
   }
}
