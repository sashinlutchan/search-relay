import { logger } from './logger'
import { unmarshall } from '@aws-sdk/util-dynamodb'

export type DbRecord = {
   eventID: string
   eventName: string
   eventVersion: string
   eventSource: string
   awsRegion: string
   dynamodb: {
      ApproximateCreationDateTime: number
      Keys: Record<string, any>
      NewImage: Record<string, any>
      OldImage?: Record<string, any>
      SequenceNumber: string
      SizeBytes: number
      StreamViewType: string
   }
   eventSourceARN: string
}

export function extractTableName(eventSourceARN: string): string {
   if (!eventSourceARN) {
      throw new Error('eventSourceARN is undefined or null')
   }

   const match = eventSourceARN.match(/table\/([^/]+)/)

   if (!match) {
      logger.error('Failed to extract table name from ARN', {
         eventSourceARN,
         isString: typeof eventSourceARN === 'string',
         length: eventSourceARN?.length,
      })
      throw new Error(
         'Could not extract table name from eventSourceARN: ' + eventSourceARN,
      )
   }

   return match[1].toLowerCase()
}

export function flattenRecord(record: DbRecord): Record<string, any> {
   if (!record.dynamodb || !record.dynamodb.NewImage) {
      logger.error('Invalid record format, missing dynamodb.NewImage', {
         record,
      })
      throw new Error('Invalid record format, missing dynamodb.NewImage')
   }

   const unmarshalled = unmarshall(record.dynamodb.NewImage as any)

   const result = {
      ...unmarshalled,
      event_id: record.eventID,
      event_name: record.eventName,
      event_source: record.eventSource,
      event_region: record.awsRegion,
      event_timestamp: new Date().toISOString(),
   }

   logger.info('Successfully unmarshalled record', {
      keys: Object.keys(result),
      recordType: record.eventName,
      unmarshalled: JSON.stringify(result),
   })

   return result
}

export function parseRecord(messageBody: string): DbRecord | null {
   try {
      const parsedBody = JSON.parse(messageBody)

      if (isDynamoDbEvent(parsedBody)) {
         return parsedBody
      }

      if (typeof parsedBody.body === 'string') {
         const innerBody = JSON.parse(parsedBody.body)
         if (isDynamoDbEvent(innerBody)) {
            return innerBody
         }
      }

      if (Array.isArray(parsedBody.Records)) {
         for (const record of parsedBody.Records) {
            if (isDynamoDbEvent(record)) {
               return record
            }

            if (typeof record.body === 'string') {
               const innerBody = JSON.parse(record.body)
               if (isDynamoDbEvent(innerBody)) {
                  return innerBody
               }
            }
         }
      }

      logger.warn('Could not find DynamoDB event in message', {
         messageKeys:
            typeof parsedBody === 'object'
               ? Object.keys(parsedBody)
               : typeof parsedBody,
         hasRecords: parsedBody && Array.isArray(parsedBody.Records),
      })

      return null
   } catch (error) {
      logger.error('Failed to parse message body', {
         error: error instanceof Error ? error.message : 'Unknown error',
         bodySnippet:
            typeof messageBody === 'string'
               ? messageBody.substring(0, 100) + '...'
               : typeof messageBody,
      })
      return null
   }
}

function isDynamoDbEvent(obj: any): obj is DbRecord {
   return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.eventID === 'string' &&
      typeof obj.eventName === 'string' &&
      obj.eventSource === 'aws:dynamodb' &&
      typeof obj.eventSourceARN === 'string' &&
      obj.dynamodb &&
      typeof obj.dynamodb === 'object'
   )
}
