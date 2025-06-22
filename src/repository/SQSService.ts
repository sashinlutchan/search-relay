export interface SQSService {
   sendMessage(
      queueUrl: string,
      messageBody: string,
      messageAttributes?: Record<string, any>,
   ): Promise<void>
   deleteMessage(queueUrl: string, receiptHandle: string): Promise<void>
}
