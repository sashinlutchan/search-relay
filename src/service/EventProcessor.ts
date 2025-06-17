import { SQSEvent } from 'aws-lambda'
import { DataService, SQSService } from '../repository'
import { SearchParams } from '../types'
import { extractTableName, flattenRecord, parseRecord } from '../utils'
import { logger } from '../utils/logger'
import assert = require('assert')
import { ProcessorService } from './ProcessorService'

export class EventProcessor implements ProcessorService {
   private dataService: DataService
   private sqsService: SQSService
   private queueUrls: string[]

   constructor(
      dataService: DataService,
      sqsService: SQSService,
      queueUrls: string[],
   ) {
      this.dataService = dataService
      this.sqsService = sqsService
      this.queueUrls = queueUrls
   }

   async process(event: SQSEvent): Promise<void> {
      if (event.Records.length === 0) {
         logger.info('No records to process')
         return
      }

      for (const sqsRecord of event.Records) {
         try {
            logger.info('Processing SQS record', {
               messageId: sqsRecord.messageId,
            })

            const item = parseRecord(sqsRecord.body)

            if (!item) {
               logger.error(
                  'Skipping record - could not parse DynamoDB event',
                  {
                     messageId: sqsRecord.messageId,
                     record: sqsRecord,
                  },
               )
               continue
            }

            const tableName = extractTableName(item.eventSourceARN)
            logger.info('Extracted table name', { tableName })

            if (!tableName) {
               throw new Error(
                  'Failed to extract table name from event source ARN',
               )
            }

            const flattenedData: Record<string, any> = flattenRecord(item)

            if (!flattenedData || Object.keys(flattenedData).length === 0) {
               throw new Error('No data to process after flattening')
            }
            const queueUrl = this.queueUrls.find((url) =>
               url.toLowerCase().includes(tableName.toLowerCase()),
            )

            assert(queueUrl, 'No queue URL found for table')

            await this.dataService.create(
               tableName.toLowerCase(),
               flattenedData.pk,
               flattenedData,
            )
         } catch (recordError) {
            logger.error('Failed to process individual record', {
               item: sqsRecord,
               messageId: sqsRecord.messageId,
               error:
                  recordError instanceof Error
                     ? recordError.message
                     : 'Unknown error',
               stack:
                  recordError instanceof Error ? recordError.stack : undefined,
            })
            continue
         }
      }
   }

   async search<T>(tableName: string, params: SearchParams): Promise<T[]> {
      return this.dataService.search<T>(tableName.toLowerCase(), params)
   }

   async purge(): Promise<void> {
      const { TABLES } = process.env

      assert(TABLES, 'Tables environment variable is required')

      const tables = TABLES?.split(',')

      for (const table of tables) {
         const sixMonthsAgo = new Date()
         sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

         const query = {
            index: table,
            body: {
               query: {
                  range: {
                     timestamp: {
                        lt: sixMonthsAgo,
                     },
                  },
               },
            },
            refresh: true,
            conflicts: 'proceed',
            slices: 'auto',
            requests_per_second: 100,
         }

         await this.dataService.deleteByQuery(table, query)
      }
   }

   async delete(tableName: string, id: string): Promise<void> {
      return this.dataService.delete(tableName.toLowerCase(), id)
   }
}
