import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'
import { DatabaseConfig } from './types'
import {
   Dynamodb,
   EventPipe,
   EventSourceMapping,
   Lambda,
   Opensearch,
   Sqs,
   Vpc,
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

   const openSearchSecret = await aws.secretsmanager.getSecret({
      name: `${stage}/opensearch/secret`,
   })

   const openSearchSecretValue = await aws.secretsmanager.getSecretVersion({
      secretId: openSearchSecret.id,
   })

   assert(
      openSearchSecretValue.secretString,
      'OpenSearch secret must be created before build',
   )
   const secretData = JSON.parse(openSearchSecretValue.secretString)
   const openSearchUsername = secretData.username
   const openSearchPassword = secretData.password

   const vpc = new Vpc('vpc', stage)
      .createVpc('10.0.0.0/16')
      .createSubnets('10.0.0.0/24', 3)
      .createSecurityGroup('0.0.0.0/0', '0.0.0.0/0')
      .createSubnetGroup()
      .build()

   const opensearch = new Opensearch(
      'opensearch',
      stage,
      vpc.securityGroup,
      vpc.subnets,
      openSearchUsername,
      openSearchPassword,
   )

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
            OPENSEARCH_SECRET: `${stage}/opensearch/secret`,
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

   const queryOpensearch = new Lambda(
      'query-opensearch',
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
      stage,
      defaultLambdaArgs,
   )
      .createRole(stage, 'process-records-role')
      .grantBasicExecution()
      .createOpensearchPolicy(stage, 'process-records-opensearch')
      .createSqsPolicy(stage, 'process-records-sqs-policy')
      .createLambda(stage, processRecordsHandler.handler, 10)
      .build()

   const purgeRecords = new Lambda('purge-records', stage, defaultLambdaArgs)
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
         .createQueue(queueName, stage, 120)
         .createEventPipePolicy(table)
         .build()

      new EventPipe(`${dbConfig.tableName.toLowerCase()}-pipe-${stage}`, stage)
         .createRole()
         .createPolicy(table, queue.arn)
         .createPipe(table, queue.arn)

      new EventSourceMapping(
         `${stage}-${dbConfig.tableName}-mapping`,
         dbConfig.tableName,
         {
            batchSize: 10,
            enabled: true,
            eventSourceArn: queue.arn,
            functionName: processRecords.lambda.arn,
         },
      )
         .createSourceMapping()
         .build()
   }

   return {
      opensearch: opensearch.domain,
      lambdas: {
         queryOpensearch: queryOpensearch.lambda.arn,
         processRecords: processRecords.lambda.arn,
         purgeRecords: purgeRecords.lambda.arn,
      },
   }
}
