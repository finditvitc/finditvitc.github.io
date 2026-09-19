#!/usr/bin/env bash
set -e

STACK_NAME="campusfind-stack"
REGION="${AWS_REGION:-us-east-1}"

echo "================================================"
echo "  CampusFind AWS Serverless Deployment"
echo "================================================"

if ! command -v sam &> /dev/null; then
    echo "Error: AWS SAM CLI is not installed."
    echo "Visit: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

echo "[1/3] Building SAM serverless package..."
sam build --template template.yaml

echo "[2/3] Deploying CloudFormation stack to AWS ($REGION)..."
sam deploy \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --resolve-s3

echo "[3/3] Deployed successfully! Retrieving stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs" \
  --output table
