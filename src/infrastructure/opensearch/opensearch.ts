import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import assert = require('assert')

export type OpensearchConfig = {
   name: string
   stage: string
   roleArn: string
}

export class Opensearch extends pulumi.ComponentResource {
   private stage: string
   private name: string
   domain: aws.opensearch.Domain | null = null
   private accountId: string

   constructor(
      name: string,
      stage: string,
      accountId: string,
   ) {
      super(`${name}-opensearch`, `${name}-opensearch`, {})
      this.stage = stage
      this.name = name
      this.accountId = accountId
   }

   createDomain(): this {
      this.domain = new aws.opensearch.Domain(
         `${this.name}-domain`,
         {
            domainName: `${this.stage}-${this.name}`,
            engineVersion: 'OpenSearch_2.11',
            
            clusterConfig: {
               instanceType: 't3.small.search',
               instanceCount: 1,
               dedicatedMasterEnabled: false,
            },
            ebsOptions: {
               ebsEnabled: true,
               volumeSize: 10,
               volumeType: 'gp2',
            },
            nodeToNodeEncryption: {
               enabled: true,
            },
            encryptAtRest: {
               enabled: true,
            },
            advancedSecurityOptions: {
               enabled: false, 
            },
            domainEndpointOptions: {
               enforceHttps: true,
               tlsSecurityPolicy: "Policy-Min-TLS-1-2-2019-07",
            },
            accessPolicies: JSON.stringify({
               Version: '2012-10-17',
               Statement: [
                  {
                     Effect: 'Allow',
                     Principal: {
                        AWS: [
                           `arn:aws:iam::${this.accountId}:role/${this.stage}-query-role`,
                           `arn:aws:iam::${this.accountId}:role/${this.stage}-process-records-role`,
                           `arn:aws:iam::${this.accountId}:role/${this.stage}-purge-records-role`
                        ]
                     },
                     Action: 'es:*',
                     Resource: '*'
                  }
               ]
            }),
            tags: {
               Name: `${this.name}-opensearch`,
               Environment: this.stage,
            },
         },
         { parent: this },
      )
      return this
   }


   configureLambdaAccess(): this {
      if (!this.domain) {
         throw new Error('Domain must be created before configuring access')
      }

      new aws.opensearch.DomainPolicy(`${this.stage}-all-access-policy`, {
         domainName: this.domain.domainName,
         accessPolicies: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
               {
                  Effect: 'Allow',
                  Principal: {
                     AWS: [
                        `arn:aws:iam::${this.accountId}:role/${this.stage}-query-role`,
                        `arn:aws:iam::${this.accountId}:role/${this.stage}-process-records-role`,
                        `arn:aws:iam::${this.accountId}:role/${this.stage}-purge-records-role`
                     ]
                  },
                  Action: 'es:*',
                  Resource: `${this.domain.arn}/*`
               }
            ]
         })
      }, { parent: this, dependsOn: [this.domain] })

      return this
   }

   public build(): {
      domain: aws.opensearch.Domain
      opensearch: Opensearch
   } {
      assert(this.domain, 'Domain must be created before build')
      return {
         domain: this.domain,
         opensearch: this,
      }
   }
}
