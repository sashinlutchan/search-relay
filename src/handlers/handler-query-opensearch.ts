import { logger } from '../utils/logger'
import { bootstrapDataRepository } from '../bootstrap'
import { ProcessorService } from '../service'
import { SearchParams } from '../types'

type Input = {
   query: SearchParams
   tableName: string
}
let dataStore: ProcessorService

export const handler = async (event: Input) => {
   logger.info('Query OpenSearch handler', {
      event,
   })
   if (!event.query) {
      logger.warn('No query in body provided in request', {
         eventKeys: Object.keys(event),
         bodyType: typeof event,
      })
      return {
         statusCode: 400,
         body: JSON.stringify({ message: 'No body' }),
      }
   }

   if (!dataStore) {
      dataStore = await bootstrapDataRepository()
   }

   const result = await dataStore.search(event.tableName, event.query)

   if (!result) {
      return {
         statusCode: 400,
         body: JSON.stringify({ message: 'No result', error: result }),
      }
   }
   return {
      statusCode: 200,
      body: JSON.stringify(result),
   }
}
