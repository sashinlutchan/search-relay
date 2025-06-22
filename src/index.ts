import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { DatabaseConfig } from './types'
import {
   Cron,
   Dynamodb,
   EventPipe,
   EventSourceMapping,
   Lambda,
   Opensearch,
   Sqs,
} from './infrastructure'
import assert = require('assert')
import {
   processRecordsHandler,
   purgeRecordsHandler,
   queryOpensearchHandler,
} from './handlers'
import { Table } from '@pulumi/aws/dynamodb'
import { Runtime } from '@pulumi/aws/lambda'

export = async () => {
   const accountId = await aws.getCallerIdentity().then((it) => it.accountId)
   const config = new pulumi.Config('app')
   const stage = config.require('stage')
   const region = aws.config.requireRegion()
   const databases = config.requireObject<DatabaseConfig[]>('databases')

   const opensearch = new Opensearch(
      'search-relay',
      stage,
      accountId,
   )
   .createDomain()
   .configureLambdaAccess()
   .build()



   const defaultLambdaArgs = {
      memorySize: 1024,
      timeout: 120,
      runtime: Runtime.NodeJS22dX,
      
      tracingConfig: {
         mode: 'Active',
      },
      architectures: ['x86_64'],
      environment: {
         variables: {
            STAGE: stage,
            OPENSEARCH_ENDPOINT: opensearch.domain?.endpoint || '',
            region: region,
            QUEUE_URLS: databases
               .map(
                  (dbConfig) =>
                     `https://sqs.${region}.amazonaws.com/${accountId}/${stage}-${dbConfig.tableName.toUpperCase()}-queue`,
               )
               .join(','),
            TABLES: databases
               .map((dbConfig) => dbConfig.tableName.toLowerCase())
               .join(','),
         },
      },
   }

   const query = new Lambda(
      'query-opensearch',
      region,
      stage,
      defaultLambdaArgs,
   )
      .createRole(stage, 'query-role')
      .grantBasicExecution()
      .createOpensearchPolicy(stage, 'query-opensearch')
      .createSqsPolicy(stage, 'query-ods-sqs-policy')
      .createLambda(stage, queryOpensearchHandler.handler)
      .build()

   const processRecords = new Lambda(
      'process-records',
      region,
      stage,
      defaultLambdaArgs,
   )
      .createRole(stage, 'process-records-role')
      .grantBasicExecution()
      .createOpensearchPolicy(stage, 'process-records-opensearch')
      .createSqsPolicy(stage, 'process-records-sqs-policy')
      .createLambda(stage, processRecordsHandler.handler, 10)
      .build()

   const purgeRecords = new Lambda('purge-records', region, stage, defaultLambdaArgs)
      .createRole(stage, 'purge-records-role')
      .grantBasicExecution()
      .createOpensearchPolicy(stage, 'purge-records-opensearch')
      .createLambda(stage, purgeRecordsHandler.handler)
      .build()

   for (const dbConfig of databases) {
      let table: Table | undefined
      if (!dbConfig.isStreamEnabled) {
         table = new Dynamodb(dbConfig.tableName, stage)
            .createTable({
               enableStreams: true,
               tableName: dbConfig.tableName,
            })
            .build()
      } else {
         table = new Dynamodb(dbConfig.tableName, stage).getTable(
            dbConfig.tableName,
         )
      }

      assert(table, 'Table not created')

      const queueName = `${dbConfig.tableName.toUpperCase()}-queue`
      const queue = new Sqs(queueName, stage)
         .createDLQ(queueName, stage)
         .createQueue(queueName, stage, 120)
         .createEventPipePolicy(table)
         .build()

      new EventPipe(`${dbConfig.tableName.toLowerCase()}-pipe-${stage}`, stage)
         .createRole()
         .createPolicy(table, queue.queue.arn)
         .createPipe(table, queue.queue.arn)

      new EventSourceMapping(
         `${stage}-${dbConfig.tableName}-mapping`,
         dbConfig.tableName,
         {
            batchSize: 10,
            enabled: true,
            eventSourceArn: queue.queue.arn,
            functionName: processRecords.lambda.arn,
         },
      )
         .createSourceMapping()
         .build()
   }


   const purgeCron  = new Cron('purge-records-cron', stage, {
      schedule: 'cron(0 0 1 * ? *)',
      name: 'purge-records-cron',
      description: 'Purge records cron job',
      enabled: true,
      lambdaArn: purgeRecords.lambda,
   })
   .createCron()
   .createTarget()
   .allowCronToInvokeLambda()
      .build()

   return {
      opensearch: opensearch.domain,
      lambdas: {
         queryOpensearch: query.lambda.arn,
         processRecords: processRecords.lambda.arn,
         purgeRecords: purgeRecords.lambda.arn,
      },
      cron: purgeCron.arn
   }
}
