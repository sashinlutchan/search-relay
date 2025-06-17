import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

export class Vpc extends pulumi.ComponentResource {
   private vpc?: aws.ec2.Vpc
   private subnet1!: aws.ec2.Subnet
   private subnet2!: aws.ec2.Subnet
   private securityGroup?: aws.ec2.SecurityGroup
   private subnetGroup?: aws.rds.SubnetGroup
   private resourceName: string
   private stage: string
   private subnets: aws.ec2.Subnet[] = []

   constructor(name: string, stage: string) {
      super(`${name}-vpc`, name)
      this.resourceName = name
      this.stage = stage
      this.registerOutputs({})
   }

   createVpc(cidrBlock: string): this {
      this.vpc = new aws.ec2.Vpc(`${this.resourceName}-${this.stage}-vpc`, {
         cidrBlock: cidrBlock,
         enableDnsHostnames: true,
         enableDnsSupport: true,
      })
      return this
   }

   createSubnets(cidrBlock: string, numberOfSubnets: number): this {
      if (!this.vpc) {
         throw new Error('VPC must be created before subnets')
      }

      const region = aws.config.requireRegion()
      const azs = [`${region}a`, `${region}b`, `${region}c`]

      for (let index = 0; index < numberOfSubnets; index++) {
         this.subnets.push(
            new aws.ec2.Subnet(
               `${this.resourceName}-${this.stage}-subnet-${index}`,
               {
                  vpcId: this.vpc.id,
                  cidrBlock: cidrBlock,
                  availabilityZone: azs[index % azs.length],
               },
               { parent: this, dependsOn: [this.vpc] },
            ),
         )
      }

      return this
   }

   createSecurityGroup(
      ingressCidrBlock: string,
      egressCidrBlock: string,
   ): this {
      if (!this.vpc) {
         throw new Error('VPC must be created before security group')
      }

      this.securityGroup = new aws.ec2.SecurityGroup(
         `${this.resourceName}-${this.stage}-sg`,
         {
            vpcId: this.vpc.id,
            ingress: [
               {
                  protocol: 'tcp',
                  fromPort: 5432,
                  toPort: 5432,
                  cidrBlocks: [ingressCidrBlock],
               },
            ],
            egress: [
               {
                  protocol: '-1',
                  fromPort: 0,
                  toPort: 0,
                  cidrBlocks: [egressCidrBlock],
               },
            ],
         },
      )

      return this
   }

   createSubnetGroup(): this {
      if (!this.subnet1 || !this.subnet2) {
         throw new Error('Subnets must be created before subnet group')
      }

      this.subnetGroup = new aws.rds.SubnetGroup(
         `${this.resourceName}-${this.stage}-subnet-group`,
         {
            subnetIds: this.subnets.map((subnet) => subnet.id),
         },
      )

      return this
   }

   public build(): {
      securityGroup: aws.ec2.SecurityGroup
      subnetGroup: aws.rds.SubnetGroup
      vpc: aws.ec2.Vpc
      subnets: aws.ec2.Subnet[]
   } {
      if (!this.securityGroup || !this.subnetGroup || !this.vpc) {
         throw new Error('Database must be created before building')
      }
      return {
         securityGroup: this.securityGroup,
         subnetGroup: this.subnetGroup,
         vpc: this.vpc,
         subnets: this.subnets,
      }
   }
}
