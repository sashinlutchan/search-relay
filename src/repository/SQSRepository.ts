import {
   SQSClient,
   DeleteMessageCommand,
   SendMessageCommand,
} from '@aws-sdk/client-sqs'
import { logger } from '../utils/logger'
import { SQSService } from './SQSService'

export class SQSRepository implements SQSService {
   private sqs: SQSClient

   constructor(sqsClient: SQSClient) {
      this.sqs = sqsClient
   }

   async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
      await this.sqs.send(
         new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
         }),
      )

      logger.info('Successfully deleted message from queue', {
         queueUrl,
         receiptHandle,
      })
   }

   async sendMessage(
      queueUrl: string,
      messageBody: string,
      messageAttributes?: Record<string, any>,
   ): Promise<void> {
      await this.sqs.send(
         new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: messageBody,
            MessageAttributes: messageAttributes,
         }),
      )

      logger.info('Successfully sent message to queue', {
         queueUrl,
         messageBody,
      })
   }
}
