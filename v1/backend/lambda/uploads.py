"""
CampusFind - S3 Upload Presign Lambda Handler
Generates presigned Amazon S3 PUT URLs for secure, direct-to-S3 photo uploads.
"""

import os
import json
import uuid
import logging
from typing import Dict, Any
import boto3
from botocore.config import Config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET_NAME = os.environ.get('PHOTOS_BUCKET_NAME', 'campusfind-item-photos')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

ALLOWED_MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
}

def get_s3_client():
    return boto3.client(
        's3',
        region_name=AWS_REGION,
        config=Config(signature_version='s3v4')
    )

def build_cors_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
        },
        'body': json.dumps(body)
    }

def generate_presigned_view_url(key: str, expires_in: int = 604800) -> str:
    """Generates a presigned GET URL for viewing private S3 images."""
    if not key:
        return ""
    try:
        s3 = get_s3_client()
        return s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': key},
            ExpiresIn=expires_in
        )
    except Exception as e:
        logger.error(f"Error generating presigned GET URL for {key}: {e}")
        return f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{key}"

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handles POST /uploads/presign."""
    http_method = event.get('httpMethod', 'POST')
    if http_method == 'OPTIONS':
        return build_cors_response(200, {'status': 'ok'})

    if http_method != 'POST':
        return build_cors_response(405, {'error': 'Method not allowed'})

    # Safe JSON decoding (BUG-08)
    try:
        body = json.loads(event.get('body') or '{}')
        if not isinstance(body, dict):
            return build_cors_response(400, {'error': 'Invalid request body: expected JSON object'})
    except (json.JSONDecodeError, TypeError):
        return build_cors_response(400, {'error': 'Invalid JSON in request body'})

    try:
        file_name = body.get('filename', 'photo.jpg')
        file_type = body.get('fileType', 'image/jpeg')
        item_id = body.get('itemId') or str(uuid.uuid4())

        if file_type not in ALLOWED_MIME_TYPES:
            return build_cors_response(400, {
                'error': f"Unsupported file type '{file_type}'. Supported: JPEG, PNG, WEBP."
            })

        ext = ALLOWED_MIME_TYPES.get(file_type, '.jpg')
        unique_key = f"items/{item_id}/{uuid.uuid4().hex[:8]}{ext}"

        s3 = get_s3_client()
        # Presigned PUT URL for upload
        presigned_upload_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key,
                'ContentType': file_type
            },
            ExpiresIn=300  # 5 minutes
        )

        # Presigned GET URL for viewing private photo without PublicAccessBlock errors (BUG-03)
        presigned_view_url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key
            },
            ExpiresIn=604800  # 7 days
        )

        return build_cors_response(200, {
            'uploadUrl': presigned_upload_url,
            'photoUrl': presigned_view_url,
            'key': unique_key,
            'itemId': item_id
        })

    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return build_cors_response(500, {'error': str(e)})
