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
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

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

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handles POST /uploads/presign."""
    http_method = event.get('httpMethod', 'POST')
    if http_method == 'OPTIONS':
        return build_cors_response(200, {'status': 'ok'})

    if http_method != 'POST':
        return build_cors_response(405, {'error': 'Method not allowed'})

    try:
        body = json.loads(event.get('body') or '{}')
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
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key,
                'ContentType': file_type
            },
            ExpiresIn=300  # 5 minutes
        )

        final_photo_url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{unique_key}"

        return build_cors_response(200, {
            'uploadUrl': presigned_url,
            'photoUrl': final_photo_url,
            'key': unique_key,
            'itemId': item_id
        })

    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return build_cors_response(500, {'error': str(e)})
