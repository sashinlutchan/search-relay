import {
   SecretsManagerClient,
   GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager'

export class SecretsManagerRepository {
   private client: SecretsManagerClient

   constructor(region: string) {
      this.client = new SecretsManagerClient({
         region: region,
      })
   }

   async getSecret<T>(secretName: string): Promise<T> {
      const command = new GetSecretValueCommand({
         SecretId: secretName,
      })
      const response = await this.client.send(command)
      return JSON.parse(response.SecretString || '{}') as T
   }
}
