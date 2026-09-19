# CampusFind - AWS Deployment Script (PowerShell)
param (
    [string]$StackName = "campusfind-stack",
    [string]$Region = "ap-south-1",
    [string]$S3Bucket = "campusfind-sam-694442891642-ap-south-1"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  CampusFind AWS Serverless Deployment" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Set environment PATH and config directory
$env:Path += ";C:\Program Files\Amazon\AWSSAMCLI\bin;C:\Users\jeris\AppData\Local\Programs\Amazon\AWSCLIV2"
$env:__SAM_CLI_APP_DIR = "C:\Users\jeris\.aws-sam-config"
$env:SAM_CLI_TELEMETRY = "0"

if (-not (Test-Path "C:\Users\jeris\.aws-sam-config")) {
    New-Item -ItemType Directory -Force -Path "C:\Users\jeris\.aws-sam-config" | Out-Null
}

# Verify AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Warning "AWS CLI is not detected in your PATH. Please install it from https://aws.amazon.com/cli/"
    exit 1
}

# Verify SAM CLI
if (-not (Get-Command sam -ErrorAction SilentlyContinue)) {
    Write-Warning "AWS SAM CLI is not detected."
    exit 1
}

Write-Host "`n[1/3] Building SAM Serverless Application..." -ForegroundColor Yellow
sam build --template template.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Error "SAM Build failed."
    exit $LASTEXITCODE
}

Write-Host "`n[2/3] Deploying to AWS Cloud ($Region)..." -ForegroundColor Yellow
sam deploy `
  --template-file .aws-sam\build\template.yaml `
  --stack-name $StackName `
  --region $Region `
  --s3-bucket $S3Bucket `
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND

if ($LASTEXITCODE -ne 0) {
    Write-Error "SAM Deployment failed."
    exit $LASTEXITCODE
}

Write-Host "`n[3/3] Deployment Successful! Fetching Stack Outputs..." -ForegroundColor Green
aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs" --output table

Write-Host "`nCopy these values into frontend/.env to connect your React app to your live AWS backend!" -ForegroundColor Cyan
