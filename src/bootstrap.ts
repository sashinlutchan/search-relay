import * as assert from 'node:assert'
import { SQSClient } from '@aws-sdk/client-sqs'
import { logger } from './utils/logger'
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws'
import { Client } from '@opensearch-project/opensearch/lib/Client'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { EventProcessor, ProcessorService } from './service'
import {
   DataRepository,
   SecretsManagerRepository,
   SQSRepository,
} from './repository'

export const bootstrapDataRepository = async (): Promise<ProcessorService> => {
   const { region, QUEUE_URLS, OPENSEARCH_SECRET, OPENSEARCH_ENDPOINT } =
      process.env

   assert(QUEUE_URLS, 'QUEUE_URLS is required')
   assert(region, 'region is required')
   assert(OPENSEARCH_SECRET, 'OPENSEARCH_SECRET is required')
   assert(OPENSEARCH_ENDPOINT, 'OPENSEARCH_ENDPOINT is required')

   const queueUrls = QUEUE_URLS.split(',')

   const secretsManagerRepository = new SecretsManagerRepository(region)
   const getSecret = await secretsManagerRepository.getSecret(OPENSEARCH_SECRET)

   if (!getSecret) {
      throw new Error('Secret not found')
   }
   const secret = JSON.parse(getSecret as string)

   // Log configuration for debugging
   logger.info('Initializing OpenSearch Data Client', {
      region,
      endpoint: OPENSEARCH_ENDPOINT,
   })

   const client = new Client({
      ...AwsSigv4Signer({
         region: region,
         service: 'es',
         getCredentials: () => defaultProvider()(),
      }),
      node: OPENSEARCH_ENDPOINT,
      auth: {
         username: secret.username,
         password: secret.password,
      },
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
