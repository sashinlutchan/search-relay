import { logger } from '../utils/logger'
import { bootstrapDataRepository } from '../bootstrap'
import { ProcessorService } from '../service'

let dataStore: ProcessorService

export const handler = async () => {
   logger.info('Purge records handler started')

   if (!dataStore) {
      dataStore = await bootstrapDataRepository()
   }

   await dataStore.purge()

   return
}
