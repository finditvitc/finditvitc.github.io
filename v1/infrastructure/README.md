# CampusFind — AWS Cloud Architecture & Deployment Guide

This directory contains the Infrastructure as Code (IaC) configuration for deploying **CampusFind** to Amazon Web Services using **AWS SAM** (Serverless Application Model) and AWS CloudFormation.

---

## AWS Services & Architecture Overview

| AWS Service | Role in CampusFind | Configuration / Details |
| :--- | :--- | :--- |
| **Amazon S3** | Image storage | `campusfind-photos-{account}-{region}` bucket with CORS and public read policy on `/items/*`. Configured with S3 Event notification on `s3:ObjectCreated:*` to invoke the Rekognition Lambda. |
| **Amazon Rekognition** | Computer Vision auto-tagging | `DetectLabels` API automatically analyzes uploaded images to identify objects (backpack, laptop, headphones, keys), colors, and categories with confidence scores. |
| **AWS Lambda** | Serverless business logic | 4 Python 3.12 Lambdas: Items CRUD & AI match engine, S3 Rekognition event trigger, Emergency Alerts SNS broadcaster, and S3 Presigned URL generator. |
| **Amazon DynamoDB** | NoSQL Data Store | `CampusFind-Items` (GSI: `TypeCreatedAtIndex`), `CampusFind-Alerts`, with Pay-Per-Request on-demand billing. |
| **Amazon SNS** | Emergency Broadcast | `CampusFind-EmergencyAlerts` topic supporting SMS and Email fan-out delivery across student subscribers. |
| **Amazon API Gateway** | REST API Gateway | Exposes CORS-enabled REST endpoints protected by Cognito User Pool Authorizer. |
| **Amazon Cognito** | Authentication & RBAC | `CampusFind-Students-Pool` with email verification, client credentials, and `Admin` group for emergency alert authorization. |

---

## Prerequisites for Cloud Deployment

1. [AWS CLI](https://aws.amazon.com/cli/) configured with `aws configure`.
2. [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).
3. An active AWS account with permissions for S3, Lambda, DynamoDB, SNS, Rekognition, Cognito, and API Gateway.

---

## Deployment Steps

### Option A: Guided SAM Deploy (First Time)

```bash
cd infrastructure
sam build
sam deploy --guided
```
During the prompt:
- Stack Name: `campusfind-stack`
- AWS Region: `us-east-1` (or your preferred region)
- Allow SAM CLI to create IAM roles with required permissions: `Y`
- Confirm changes before deploy: `Y`
- Allow unauthenticated access to public GET routes: `Y`

### Option B: One-Click Automated Script

- **On Windows (PowerShell):**
  ```powershell
  .\deploy.ps1 -Region us-east-1
  ```

- **On Linux / macOS:**
  ```bash
  chmod +x deploy.sh
  ./deploy.sh
  ```

---

## Connecting Frontend to Deployed AWS Backend

Once deployed, copy the stack outputs into `frontend/.env`:

```env
VITE_AWS_MODE=true
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=<user-pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_S3_BUCKET_NAME=<photos-bucket-name>
VITE_AWS_REGION=us-east-1
```
