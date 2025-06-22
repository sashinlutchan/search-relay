import { SQSEvent } from 'aws-lambda'
import { bootstrapDataRepository } from '../bootstrap'
import { logger } from '../utils/logger'
import { ProcessorService } from '../service'
let dataStore: ProcessorService

export const handler = async (event: SQSEvent) => {
   logger.info('Processing SQS records handler', {
      event,
   })
   if (!dataStore) {
      dataStore = await bootstrapDataRepository()
   }

   await dataStore.process(event)
}
