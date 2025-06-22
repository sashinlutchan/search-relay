import * as assert from 'node:assert'
import { SQSClient } from '@aws-sdk/client-sqs'
import { logger } from './utils/logger'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import { Client } from '@opensearch-project/opensearch'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { EventProcessor, ProcessorService } from './service'
import {
   DataRepository,
   SQSRepository,
} from './repository'

export const bootstrapDataRepository = async (): Promise<ProcessorService> => {
   const { region, QUEUE_URLS, OPENSEARCH_ENDPOINT } =
      process.env

   assert(QUEUE_URLS, 'QUEUE_URLS is required')
   assert(region, 'region is required')
   assert(OPENSEARCH_ENDPOINT, 'OPENSEARCH_ENDPOINT is required')

   const queueUrls = QUEUE_URLS.split(',')

   logger.info('Initializing OpenSearch Data Client with IAM authentication', {
      region,
      endpoint: OPENSEARCH_ENDPOINT,
   })

   const client = new Client({
      node: `https://${OPENSEARCH_ENDPOINT}`,
      ...AwsSigv4Signer({
         region: region,
         service: 'es',
         getCredentials: () => {
            return defaultProvider()()
         },
      }),
   })

   return new EventProcessor(
      new DataRepository(client),
      new SQSRepository(
         new SQSClient({
            region: region,
         }),
      ),
      queueUrls,
   )
}
