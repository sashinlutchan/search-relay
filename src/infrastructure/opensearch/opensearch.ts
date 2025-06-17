import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import assert = require('assert')

export type OpensearchConfig = {
   name: string
   stage: string
   securityGroup: aws.ec2.SecurityGroup
   subnets: aws.ec2.Subnet[]
   roleArn: string
}

export class Opensearch extends pulumi.ComponentResource {
   private stage: string
   private name: string
   domain: aws.opensearch.Domain | null = null
   private securityGroup: aws.ec2.SecurityGroup | null = null
   private subnets: aws.ec2.Subnet[] = []
   private username: string
   private password: string

   constructor(
      name: string,
      stage: string,
      securityGroup: aws.ec2.SecurityGroup,
      subnets: aws.ec2.Subnet[],
      username: string,
      password: string,
   ) {
      super(`${name}-opensearch`, `${name}-opensearch`, {})
      this.stage = stage
      this.name = name
      this.username = username
      this.password = password
      this.securityGroup = securityGroup
      this.subnets = subnets
   }

   createDomain(): this {
      assert(this.securityGroup, 'Security group must be created before domain')
      assert(this.subnets.length > 0, 'Subnets must be created before domain')

      this.domain = new aws.opensearch.Domain(
         `${this.name}-domain`,
         {
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
            vpcOptions: {
               securityGroupIds: [this.securityGroup.id],
               subnetIds: this.subnets.map((subnet) => subnet.id),
            },
            nodeToNodeEncryption: {
               enabled: true,
            },
            encryptAtRest: {
               enabled: true,
            },
            advancedSecurityOptions: {
               enabled: true,
               internalUserDatabaseEnabled: false,
               masterUserOptions: {
                  masterUserName: this.username,
                  masterUserPassword: this.password,
               },
            },
            tags: {
               Name: `${name}-opensearch`,
               Environment: this.stage,
            },
         },
         { parent: this, dependsOn: [this.securityGroup, ...this.subnets] },
      )
      return this
   }

   public build(): {
      domain: aws.opensearch.Domain
   } {
      assert(this.domain, 'Domain must be created before build')
      return {
         domain: this.domain,
      }
   }
}
