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
      if (!event.Records) {
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

            const save = await this.dataService.create(
               tableName.toLowerCase(),
               flattenedData.pk,
               flattenedData,
            )

            if (save) {
               await this.sqsService.deleteMessage(queueUrl, sqsRecord.receiptHandle)
            }
         } catch (recordError) {
            logger.error('Failed to process individual record', {
               item: sqsRecord,
               messageId: sqsRecord.messageId,
               error: recordError,
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
         try {
            const setSixMonthsAgo = new Date()
            setSixMonthsAgo.setMonth(setSixMonthsAgo.getMonth() - 6)
           

          
            const query = {
               range: {
                  event_timestamp: {
                     lt: setSixMonthsAgo.toISOString(),
                  },
               },
            }

            await this.dataService.deleteByQuery(table, query)
            
            logger.info('Successfully purged old records', { table })
         } catch (error) {
            logger.error('Failed to purge records from table', {
               table,
               error: error instanceof Error ? error.message : 'Unknown error',
               stack: error instanceof Error ? error.stack : undefined,
            })
         
         }
      }
   }

   async delete(tableName: string, id: string): Promise<void> {
      return this.dataService.delete(tableName.toLowerCase(), id)
   }
}
