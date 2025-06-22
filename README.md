
# Search Relay

### 🚀 Purpose
The goal of this system is to build a **real-time, scalable search relay** that continuously ingests, transforms, and indexes DynamoDB data into **OpenSearch**. It enables powerful full-text and filtered search capabilities on data originally stored in DynamoDB, which lacks native search support.

The system leverages **EventBridge Pipes** to streamline the connection between DynamoDB Streams and SQS, minimizing custom infrastructure. **Lambda functions** handle transformation and indexing, keeping the pipeline serverless, cost-effective, and low-latency.

---

### 🧩 Problem Statement
DynamoDB is highly performant for key-based queries but lacks native support for complex search operations like:

- Full-text queries
- Range filters
- Aggregations
- Free-form filtering
Developers often need to run powerful search queries on transactional or event data stored in DynamoDB — something DynamoDB can't do efficiently. The lack of direct integration between DynamoDB and OpenSearch adds complexity, often requiring custom pollers or brittle pipelines.

---

### ✅ This project solves that by:
- Listening to **DynamoDB Streams** for real-time change data capture (CDC)
- Piping data through **EventBridge Pipes** to an **SQS queue**
- Using **Lambda functions** to:
    - Transform raw stream data into searchable format
    - Index it into an **OpenSearch domain**
This design keeps the architecture **event-driven**, **modular**, and **cost-efficient**, while making your DynamoDB data **fully searchable** in near real-time.


### ⚙️ AWS services

-  Dynamodb  / Dynamodb Streams
-  Event pipes
-  SQS
-  lambdas
-  OpenSearch
  
### Architecture  Diagram

![Search Realy  Architecture Diagram](./docs/search-relay-digram.png)





🚀 Getting Started
📋 Prerequisites

    AWS Account with appropriate permissions
    AWS CLI configured
    pulumi account personal access tokekn
    S3 bucket ( for pulumi state, Note all state of stack is kept in s3 bucket )

🔐 GitHub Secrets Configuration

For the CI/CD pipeline to work, configure the following secrets in your GitHub repository settings:
🔑 AWS Credentials (Staging)

    AWS_ACCESS_KEY_ID_STAGING - AWS access key for staging environment
        Example: AKIAIOSFODNN7EXAMPLE
    AWS_SECRET_ACCESS_KEY_STAGING - AWS secret key for staging environment
        Example: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
    AWS_REGION - AWS region (e.g., af-south-1)
        Example: af-south-1

⚙️ Pulumi Configuration

    PULUMI_ACCESS_TOKEN - Personal access token from Pulumi Cloud
        Example: pul-1234567890abcdef1234567890abcdef12345678
    PULUMI_STATE_BUCKET - S3 bucket name for storing Pulumi state files
        Example: my-company-pulumi-state-bucket




⚙️ Pulumi Config Setup
📚 Configuration Parameters Explained

Purpose: This configuration controls how the Search Relay system manages DynamoDB tables and their streams based on your existing infrastructure.

isStreamEnabled Parameter:

    true: Indicates the DynamoDB table already exists with streams enabled
        The code will reference the existing table
        No new table creation will occur
        Assumes DynamoDB Streams are already configured and running
        Used when you have pre-existing tables that you want to integrate into the Search Relay pipeline

    false: Indicates the DynamoDB table does not exist
        The Pulumi code will create a new DynamoDB table
        DynamoDB Streams will be configured during table creation
        Used for fresh deployments or when creating new tables specifically for the Search Relay system

Why This Matters: This configuration allows the Search Relay system to work with both existing DynamoDB infrastructure and new deployments, providing flexibility for different deployment scenarios without requiring manual table recreation or stream reconfiguration.

    const config = new pulumi.Config('app')
    const stage = config.require('stage')
    const region = aws.config.requireRegion()
    const databases = config.requireObject<DatabaseConfig[]>('databases')

config:
   aws:region: af-south-1
   app:stage: staging
   app:databases:
      - tableName: Products
        isStreamEnabled: true
      - tableName: Stock
        isStreamEnabled: true

Note: The application will automatically retrieve these credentials during deployment and runtime.
🛠️ Commands

    yarn build ( Linux / Mac ) / yarn build:win ( Windows ) - Compiles TypeScript
    yarn preview - Shows what changes Pulumi will make without applying them
    yarn deploy - Builds the project and deploys infrastructure to AWS using Pulumi ( Linux / Mac )
    yarn deploy:win - Builds the project and deploys infrastructure to AWS using Pulumi (Windows)
    yarn destroy - Removes all deployed infrastructure from AWS
