import os
import json
import uuid
import base64
import logging
from typing import Dict, Any
import boto3
from botocore.config import Config

try:
    from rekognition_processor import analyze_image_bytes, extract_semantic_vision_tags
except ImportError:
    analyze_image_bytes = None
    extract_semantic_vision_tags = None

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

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Handles POST /uploads/presign and POST /rekognition/analyze."""
    http_method = event.get('httpMethod', 'POST')
    path = event.get('path', '')
    if http_method == 'OPTIONS':
        return build_cors_response(200, {'status': 'ok'})

    if http_method != 'POST':
        return build_cors_response(405, {'error': 'Method not allowed'})

    try:
        body = json.loads(event.get('body') or '{}')
        if not isinstance(body, dict):
            return build_cors_response(400, {'error': 'Invalid request body: expected JSON object'})
    except (json.JSONDecodeError, TypeError):
        return build_cors_response(400, {'error': 'Invalid JSON in request body'})

    # Handle direct text-based Rekognition analysis: POST /rekognition/analyze
    if '/rekognition/analyze' in path or ('description' in body and not body.get('imageBase64') and not body.get('filename')):
        title = body.get('title', '')
        category = body.get('category', '')
        description = body.get('description', '')
        if extract_semantic_vision_tags:
            res = extract_semantic_vision_tags(f"{title} {description}", category=category)
            return build_cors_response(200, res)
        return build_cors_response(200, {
            'ai_tags': [category or 'Item'],
            'detected_labels': [{'name': category or 'Item', 'confidence': 90.0}],
            'dominant_colors': []
        })

    try:
        file_name = body.get('filename', 'photo.jpg')
        file_type = body.get('fileType', 'image/jpeg')
        category = body.get('category', '')
        title = body.get('title', '')
        image_base64 = body.get('imageBase64', '')
        item_id = body.get('itemId') or str(uuid.uuid4())

        if file_type not in ALLOWED_MIME_TYPES:
            file_type = 'image/jpeg'

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
            ExpiresIn=600  # 10 minutes
        )

        # Presigned GET URL for viewing private photo without 403 Forbidden errors (BUG-03)
        presigned_view_url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key
            },
            ExpiresIn=604800  # 7 days
        )

        ai_tags = []
        detected_labels = []
        dominant_colors = []

        # Synchronously save image to S3 & analyze image bytes via Amazon Rekognition
        if image_base64:
            try:
                clean_b64 = image_base64.split(',')[1] if ',' in image_base64 else image_base64
                raw_bytes = base64.b64decode(clean_b64)
                
                # Directly write to S3 bucket so image is immediately available
                try:
                    s3.put_object(
                        Bucket=BUCKET_NAME,
                        Key=unique_key,
                        Body=raw_bytes,
                        ContentType=file_type
                    )
                except Exception as s3_err:
                    logger.warning(f"Direct S3 write note: {s3_err}")

                if analyze_image_bytes:
                    analysis = analyze_image_bytes(raw_bytes, filename_hint=f"{title} {file_name}", category_hint=category)
                    ai_tags = analysis.get('ai_tags', [])
                    detected_labels = analysis.get('detected_labels', [])
                    dominant_colors = analysis.get('dominant_colors', [])
            except Exception as rek_err:
                logger.warning(f"Synchronous Rekognition error: {rek_err}")

        if not ai_tags and extract_semantic_vision_tags:
            fallback = extract_semantic_vision_tags(f"{title} {file_name}", category=category)
            ai_tags = fallback.get('ai_tags', [])
            detected_labels = fallback.get('detected_labels', [])

        return build_cors_response(200, {
            'uploadUrl': presigned_upload_url,
            'photoUrl': presigned_view_url,
            'key': unique_key,
            'itemId': item_id,
            'ai_tags': ai_tags,
            'detected_labels': detected_labels,
            'dominant_colors': dominant_colors
        })

    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return build_cors_response(500, {'error': str(e)})
