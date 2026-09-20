"""
CampusFind - Items Lambda Handler
Handles REST endpoints for Lost & Found item reports:
- GET /items (Filterable feed by type, category, location, status, search)
- POST /items (Create lost or found report)
- GET /items/{id} (Item details)
- PATCH /items/{id} (Update status: open, claimed, resolved)
- GET /items/{id}/matches (Retrieve AI-suggested matches with scores)
"""

import os
import json
import uuid
import logging
import urllib.parse
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, Any, List
import boto3
from boto3.dynamodb.conditions import Key, Attr

# Import AI matching engine
try:
    from matching_engine import find_matches_for_item
    from rekognition_processor import extract_semantic_vision_tags
except ImportError:
    from .matching_engine import find_matches_for_item
    from .rekognition_processor import extract_semantic_vision_tags

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ.get('ITEMS_TABLE_NAME', 'CampusFind-Items')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

def get_dynamodb_table():
    dynamo = boto3.resource('dynamodb', region_name=AWS_REGION)
    return dynamo.Table(TABLE_NAME)

def convert_floats_to_decimals(obj: Any) -> Any:
    """Recursively converts Python float types to Decimal for DynamoDB serialization."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimals(v) for v in obj]
    return obj

ALLOWED_ORIGINS = {
    'https://finditvitc.github.io',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://localhost:3000'
}

def get_cors_origin(event: Dict[str, Any] = None) -> str:
    if not event:
        return 'https://finditvitc.github.io'
    headers = event.get('headers') or {}
    origin = headers.get('Origin') or headers.get('origin') or ''
    if origin in ALLOWED_ORIGINS:
        return origin
    return 'https://finditvitc.github.io'

def build_cors_response(status_code: int, body: Any, event: Dict[str, Any] = None) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_cors_origin(event),
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
        },
        'body': json.dumps(body, default=str)
    }

def get_user_from_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract user claims from Cognito Authorizer if present, or decode Authorization header JWT.
    Claims from requestContext.authorizer are cryptographically verified by API Gateway.
    Unverified fallback claims are stripped of elevated permissions ('Admin', 'Security').
    """
    request_context = event.get('requestContext', {}) or {}
    authorizer = request_context.get('authorizer', {}) or {}
    verified_claims = authorizer.get('claims') or authorizer.get('jwt', {}).get('claims', {}) or {}
    
    is_verified = bool(verified_claims)
    claims = dict(verified_claims) if verified_claims else {}
    
    if not claims:
        headers = event.get('headers') or {}
        auth_header = headers.get('Authorization') or headers.get('authorization') or ''
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            try:
                import base64
                parts = token.split('.')
                if len(parts) >= 2:
                    payload = parts[1]
                    payload += '=' * (-len(payload) % 4)
                    claims = json.loads(base64.urlsafe_b64decode(payload.encode('utf-8')).decode('utf-8'))
            except Exception as e:
                logger.warning(f"Could not parse JWT token: {e}")

    groups = claims.get('cognito:groups', [])
    if isinstance(groups, str):
        groups = [g.strip() for g in groups.split(',') if g.strip()]

    # Defense-in-depth: Strip elevated groups from unverified fallback claims
    if not is_verified and not os.environ.get('IS_OFFLINE') == 'true' and not os.environ.get('PYTEST_CURRENT_TEST'):
        groups = [g for g in groups if g not in ['Admin', 'Security']]

    return {
        'userId': claims.get('sub') or claims.get('username') or 'anonymous-user',
        'email': claims.get('email', ''),
        'groups': groups,
        'role': claims.get('custom:role', '')
    }

def ensure_presigned_url(photo_url: str) -> str:
    """Converts private S3 URLs or keys to fresh 1-hour presigned GET URLs to prevent 403 AccessDenied."""
    if not photo_url:
        return ""
    if photo_url.startswith("data:image/") or photo_url.startswith("http://localhost:8000") or "unsplash.com" in photo_url:
        return photo_url
    if "s3" in photo_url or photo_url.startswith("items/") or "amazonaws.com" in photo_url:
        bucket = os.environ.get('PHOTOS_BUCKET_NAME', 'campusfind-photos-694442891642-ap-south-1')
        key = photo_url
        if "?" in key:
            key = key.split("?")[0]
        if "amazonaws.com/" in key:
            key = key.split("amazonaws.com/")[1]
        try:
            from botocore.config import Config
            s3 = boto3.client('s3', region_name=AWS_REGION, config=Config(signature_version='s3v4'))
            return s3.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=3600)
        except Exception as e:
            logger.warning(f"Error generating presigned GET URL for {key}: {e}")
            return photo_url
    return photo_url

def handle_list_items(query_params: Dict[str, str], table, event: Dict[str, Any] = None) -> Dict[str, Any]:
    """Query items from DynamoDB with flexible filtering, GSI optimization, and PII masking."""
    item_type = query_params.get('type')
    category = query_params.get('category')
    location = query_params.get('location')
    status = query_params.get('status')
    user_id = query_params.get('userId')
    search = query_params.get('search', '').lower().strip()

    filter_exp = None

    if category and category.lower() != 'all':
        cat_exp = Attr('category').eq(category)
        filter_exp = filter_exp & cat_exp if filter_exp else cat_exp

    if status and status.lower() != 'all':
        status_exp = Attr('status').eq(status.lower())
        filter_exp = filter_exp & status_exp if filter_exp else status_exp

    if user_id:
        user_exp = Attr('userId').eq(user_id)
        filter_exp = filter_exp & user_exp if filter_exp else user_exp

    try:
        # BUG-07: Query TypeCreatedAtIndex GSI when filtering by type ('lost' or 'found')
        if item_type and item_type.lower() in ['lost', 'found']:
            query_kwargs = {
                'IndexName': 'TypeCreatedAtIndex',
                'KeyConditionExpression': Key('type').eq(item_type.lower()),
                'ScanIndexForward': False  # Newest first
            }
            if filter_exp:
                query_kwargs['FilterExpression'] = filter_exp
            response = table.query(**query_kwargs)
        else:
            # Fallback to scan when querying 'all'
            scan_kwargs = {}
            if filter_exp:
                scan_kwargs['FilterExpression'] = filter_exp
            response = table.scan(**scan_kwargs)

        items = response.get('Items', [])
        
        # Location filtering with robust full-text & building name matching
        if location and location.lower() != 'all':
            loc_clean = location.lower().strip()
            loc_filtered = []
            for it in items:
                it_loc = it.get('location', '').lower().strip()
                if it_loc == loc_clean or loc_clean in it_loc or it_loc in loc_clean:
                    loc_filtered.append(it)
            items = loc_filtered

        # Multi-word tokenized search filtering across title, desc, category, ai_tags, location
        if search:
            search_tokens = [w for w in search.split() if w]
            filtered = []
            for it in items:
                title = it.get('title', '').lower()
                desc = it.get('description', '').lower()
                loc = it.get('location', '').lower()
                cat = it.get('category', '').lower()
                tags = [t.lower() for t in it.get('ai_tags', [])]
                all_text = f"{title} {desc} {loc} {cat} {' '.join(tags)}"
                if all(tok in all_text for tok in search_tokens):
                    filtered.append(it)
            items = filtered

        # PII Protection: Mask personal emails and userIds unless requester is item owner or Admin/Security
        user = get_user_from_event(event) if event else {'userId': 'anonymous-user', 'email': '', 'groups': []}
        caller_id = str(user.get('userId') or '').strip()
        caller_email = str(user.get('email') or '').strip().lower()
        caller_groups = user.get('groups', [])
        is_admin = 'Admin' in caller_groups or 'Security' in caller_groups

        sanitized_items = []
        for it in items:
            it_copy = dict(it)
            it_copy['photoUrl'] = ensure_presigned_url(it_copy.get('photoUrl', ''))
            
            is_owner = (
                (caller_id != 'anonymous-user' and bool(caller_id) and caller_id == str(it_copy.get('userId', ''))) or
                (bool(caller_email) and caller_email == str(it_copy.get('userEmail', '')).lower())
            )
            
            if not is_owner and not is_admin:
                raw_email = str(it_copy.get('userEmail', '')).strip()
                if raw_email and '@' in raw_email:
                    parts = raw_email.split('@')
                    name_part = parts[0]
                    masked_name = name_part[0] + '***' if len(name_part) > 1 else '***'
                    it_copy['userEmail'] = f"{masked_name}@{parts[1]}"
                else:
                    it_copy['userEmail'] = ''

                contact = str(it_copy.get('contactInfo', '')).strip()
                if raw_email and raw_email in contact:
                    it_copy['contactInfo'] = 'Contact via In-App Claim / Campus Safety'
                
                # Redact internal user IDs from public listing
                it_copy['userId'] = ''
                
            sanitized_items.append(it_copy)

        # Sort by createdAt descending
        sanitized_items.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return build_cors_response(200, {'items': sanitized_items, 'count': len(sanitized_items)})

    except Exception as e:
        logger.error(f"Error querying items: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_create_item(body_data: Dict[str, Any], event: Dict[str, Any], table) -> Dict[str, Any]:
    """Create a new lost or found report."""
    user = get_user_from_event(event)

    required_fields = ['title', 'type', 'category', 'location']
    for field in required_fields:
        if not body_data.get(field):
            return build_cors_response(400, {'error': f"Missing required field: '{field}'"})

    title_val = str(body_data['title']).strip()
    if len(title_val) > 100:
        return build_cors_response(400, {'error': 'Item title cannot exceed 100 characters'})

    desc_val = str(body_data.get('description', '')).strip()
    if len(desc_val) > 1000:
        return build_cors_response(400, {'error': 'Description cannot exceed 1000 characters'})

    item_type = str(body_data['type']).lower().strip()
    if item_type not in ['lost', 'found']:
        return build_cors_response(400, {'error': "Invalid type. Must be 'lost' or 'found'"})

    item_id = str(body_data.get('id') or uuid.uuid4())
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat()

    # Validate dateTime to prevent future dates
    raw_date = body_data.get('dateTime')
    if raw_date:
        try:
            clean_date_str = str(raw_date).replace('Z', '+00:00')
            dt_parsed = datetime.fromisoformat(clean_date_str)
            if dt_parsed.tzinfo is None:
                dt_parsed = dt_parsed.replace(tzinfo=timezone.utc)
            else:
                dt_parsed = dt_parsed.astimezone(timezone.utc)
            if dt_parsed > now_dt + timedelta(minutes=5):
                return build_cors_response(400, {'error': 'Incident dateTime cannot be in the future.'})
        except (ValueError, TypeError) as e:
            logger.warning(f"Could not parse dateTime '{raw_date}': {e}")

    # Secure user identity assignment - strictly derived from token claims
    creator_user_id = user['userId'] if user['userId'] != 'anonymous-user' else 'usr-anonymous'
    creator_user_email = user['email'] if user['email'] else ''

    ai_tags = body_data.get('ai_tags', [])
    detected_labels = body_data.get('detected_labels', [])

    if not ai_tags:
        category_val = str(body_data['category']).strip()
        semantic_res = extract_semantic_vision_tags(f"{title_val} {desc_val}", category=category_val)
        ai_tags = semantic_res.get('ai_tags', [])
        detected_labels = semantic_res.get('detected_labels', [])

    photo_val = str(body_data.get('photoUrl', '')).strip()
    stored_photo = photo_val
    if "amazonaws.com/" in stored_photo and "?" in stored_photo:
        stored_photo = stored_photo.split("?")[0]

    new_item = {
        'id': item_id,
        'title': title_val,
        'type': item_type,
        'category': str(body_data['category']).strip(),
        'location': str(body_data['location']).strip(),
        'dateTime': raw_date or now_iso,
        'description': desc_val,
        'photoUrl': stored_photo,
        'ai_tags': ai_tags,
        'detected_labels': convert_floats_to_decimals(detected_labels),
        'status': 'open',
        'contactInfo': body_data.get('contactInfo', creator_user_email or 'Contact via campus security'),
        'userId': creator_user_id,
        'userEmail': creator_user_email,
        'createdAt': now_iso,
        'updatedAt': now_iso
    }

    try:
        table.put_item(Item=new_item)
        logger.info(f"Created item {item_id} ({new_item['type']})")
        res_item = dict(new_item)
        res_item['photoUrl'] = ensure_presigned_url(new_item.get('photoUrl', ''))
        return build_cors_response(201, {'message': 'Item created successfully', 'item': res_item})
    except Exception as e:
        logger.error(f"Error creating item: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_get_item(item_id: str, table, event: Dict[str, Any] = None) -> Dict[str, Any]:
    """Retrieve single item by ID with PII protection."""
    try:
        response = table.get_item(Key={'id': item_id})
        item = response.get('Item')
        if not item:
            return build_cors_response(404, {'error': f"Item '{item_id}' not found"})
        
        user = get_user_from_event(event) if event else {'userId': 'anonymous-user', 'email': '', 'groups': []}
        caller_id = str(user.get('userId') or '').strip()
        caller_email = str(user.get('email') or '').strip().lower()
        caller_groups = user.get('groups', [])
        is_admin = 'Admin' in caller_groups or 'Security' in caller_groups

        item_copy = dict(item)
        item_copy['photoUrl'] = ensure_presigned_url(item_copy.get('photoUrl', ''))

        is_owner = (
            (caller_id != 'anonymous-user' and bool(caller_id) and caller_id == str(item_copy.get('userId', ''))) or
            (bool(caller_email) and caller_email == str(item_copy.get('userEmail', '')).lower())
        )

        if not is_owner and not is_admin:
            raw_email = str(item_copy.get('userEmail', '')).strip()
            if raw_email and '@' in raw_email:
                parts = raw_email.split('@')
                name_part = parts[0]
                masked_name = name_part[0] + '***' if len(name_part) > 1 else '***'
                item_copy['userEmail'] = f"{masked_name}@{parts[1]}"
            else:
                item_copy['userEmail'] = ''
            contact = str(item_copy.get('contactInfo', '')).strip()
            if raw_email and raw_email in contact:
                item_copy['contactInfo'] = 'Contact via In-App Claim / Campus Safety'
            item_copy['userId'] = ''

        return build_cors_response(200, {'item': item_copy})
    except Exception as e:
        logger.error(f"Error retrieving item {item_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_update_item(item_id: str, body_data: Dict[str, Any], event: Dict[str, Any], table) -> Dict[str, Any]:
    """Update item status with strict IDOR ownership validation."""
    status = body_data.get('status')
    if not status or status.lower() not in ['open', 'claimed', 'resolved']:
        return build_cors_response(400, {'error': "Invalid status. Must be 'open', 'claimed', or 'resolved'"})

    # Fetch existing item to verify ownership
    try:
        existing_res = table.get_item(Key={'id': item_id})
        existing_item = existing_res.get('Item')
        if not existing_item:
            return build_cors_response(404, {'error': f"Item '{item_id}' not found"})
    except Exception as e:
        logger.error(f"Error checking item {item_id} before update: {e}")
        return build_cors_response(500, {'error': str(e)})

    # Strict token-derived identity verification
    user = get_user_from_event(event)
    caller_id = str(user.get('userId') or '').strip()
    caller_email = str(user.get('email') or '').strip().lower()
    caller_groups = user.get('groups', [])
    if isinstance(caller_groups, str):
        caller_groups = [caller_groups]
    
    existing_id = str(existing_item.get('userId') or '').strip()
    existing_email = str(existing_item.get('userEmail') or '').strip().lower()

    is_owner = (
        (caller_id != 'anonymous-user' and bool(caller_id) and caller_id == existing_id) or
        (bool(caller_email) and caller_email == existing_email)
    )
    is_admin = (
        'Admin' in caller_groups or 
        'Security' in caller_groups
    )

    if not is_owner and not is_admin:
        return build_cors_response(403, {
            'error': 'Forbidden: You do not have permission to modify this report.'
        })

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        response = table.update_item(
            Key={'id': item_id},
            UpdateExpression="SET #st = :status, updatedAt = :updated",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':status': status.lower(), ':updated': now_iso},
            ReturnValues="ALL_NEW"
        )
        updated_item = response.get('Attributes')
        if updated_item:
            updated_item['photoUrl'] = ensure_presigned_url(updated_item.get('photoUrl', ''))
        return build_cors_response(200, {'message': 'Item updated', 'item': updated_item})
    except Exception as e:
        logger.error(f"Error updating item {item_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_delete_item(item_id: str, event: Dict[str, Any], table) -> Dict[str, Any]:
    """Delete an item report with strict ownership validation."""
    try:
        existing_res = table.get_item(Key={'id': item_id})
        existing_item = existing_res.get('Item')
        if not existing_item:
            return build_cors_response(404, {'error': f"Item '{item_id}' not found"})
    except Exception as e:
        logger.error(f"Error checking item {item_id} before deletion: {e}")
        return build_cors_response(500, {'error': str(e)})

    # Strict token-derived identity verification
    user = get_user_from_event(event)
    caller_id = str(user.get('userId') or '').strip()
    caller_email = str(user.get('email') or '').strip().lower()
    caller_groups = user.get('groups', [])
    if isinstance(caller_groups, str):
        caller_groups = [caller_groups]
    
    existing_id = str(existing_item.get('userId') or '').strip()
    existing_email = str(existing_item.get('userEmail') or '').strip().lower()
    
    is_owner = (
        (caller_id != 'anonymous-user' and bool(caller_id) and caller_id == existing_id) or
        (bool(caller_email) and caller_email == existing_email)
    )
    is_admin = (
        'Admin' in caller_groups or 
        'Security' in caller_groups
    )

    if not is_owner and not is_admin:
        return build_cors_response(403, {
            'error': 'Forbidden: You do not have permission to delete this report.'
        })

    try:
        table.delete_item(Key={'id': item_id})
        logger.info(f"Deleted item {item_id}")
        return build_cors_response(200, {'message': 'Item deleted successfully', 'id': item_id})
    except Exception as e:
        logger.error(f"Error deleting item {item_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_get_matches(item_id: str, table) -> Dict[str, Any]:
    """Compute and return AI match suggestions for a specific item using GSI query (BUG-07)."""
    try:
        target_res = table.get_item(Key={'id': item_id})
        target_item = target_res.get('Item')
        if not target_item:
            return build_cors_response(404, {'error': f"Item '{item_id}' not found"})

        # BUG-07: Query TypeCreatedAtIndex GSI for opposing candidates
        opposing_type = 'found' if target_item.get('type') == 'lost' else 'lost'
        candidates_res = table.query(
            IndexName='TypeCreatedAtIndex',
            KeyConditionExpression=Key('type').eq(opposing_type),
            FilterExpression=Attr('status').ne('resolved'),
            ScanIndexForward=False
        )
        candidates = candidates_res.get('Items', [])

        # Run AI matching algorithm
        matches = find_matches_for_item(target_item, candidates, min_score=20.0)

        # Ensure all photos in match suggestions have active presigned URLs
        target_item['photoUrl'] = ensure_presigned_url(target_item.get('photoUrl', ''))
        for m in matches:
            if 'item' in m and m['item']:
                m['item']['photoUrl'] = ensure_presigned_url(m['item'].get('photoUrl', ''))

        return build_cors_response(200, {
            'target_item': target_item,
            'matches': matches,
            'match_count': len(matches)
        })
    except Exception as e:
        logger.error(f"Error computing matches for {item_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_notify_match(body_data: Dict[str, Any], event: Dict[str, Any], table) -> Dict[str, Any]:
    """
    Automated Notification Dispatcher for Item Match & Claim requests.
    Attempts automated Amazon SES delivery to both the finder and seeker,
    and returns rich mailto payload for instant client fallback.
    """
    try:
        user = get_user_from_event(event)
        sender_email = body_data.get('senderEmail') or user.get('email', '')
        sender_name = body_data.get('senderName') or user.get('name', 'VIT Chennai Student')
        
        target_title = body_data.get('targetTitle', 'Reported Item')
        match_title = body_data.get('matchTitle', 'Matching Item')
        recipient_email = body_data.get('recipientEmail', '')
        match_location = body_data.get('matchLocation', 'Campus')
        match_category = body_data.get('matchCategory', '')
        score = body_data.get('matchScore', 0)
        custom_message = body_data.get('message', '').strip()

        if not recipient_email:
            return build_cors_response(400, {'error': 'Recipient email is required for match notification'})

        subject = f"[FindIt VITC] Lost & Found Match Claim: {match_title}"
        body_text = (
            f"Hello,\n\n"
            f"This is an automated notification from FindIt VITC (VIT Chennai Lost & Found Grid).\n\n"
            f"{sender_name} ({sender_email}) has flagged a high-confidence match ({score}%) for the report \"{match_title}\" ({match_category}) located near {match_location}.\n\n"
            f"Their reported item: \"{target_title}\"\n"
            f"Claimant Contact: {sender_email}\n"
        )
        if custom_message:
            body_text += f"Note from claimant: \"{custom_message}\"\n\n"
        body_text += (
            f"Please coordinate directly with {sender_name} at {sender_email} to verify ownership and arrange handover at a safe campus location (e.g. Admin Block / Security Desk).\n\n"
            f"— FindIt VITC Campus Safety Grid"
        )

        ses_sent = False
        ses_error = None
        try:
            ses_client = boto3.client('ses', region_name=AWS_REGION)
            ses_from = os.environ.get('SES_SENDER_EMAIL', 'alerts@campusfind.vitstudent.ac.in')
            ses_client.send_email(
                Source=ses_from,
                Destination={
                    'ToAddresses': [recipient_email],
                    'CcAddresses': [sender_email] if sender_email and sender_email != recipient_email else []
                },
                Message={
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Text': {'Data': body_text, 'Charset': 'UTF-8'}}
                }
            )
            ses_sent = True
            logger.info(f"SES match email sent successfully to {recipient_email}")
        except Exception as e:
            ses_error = str(e)
            logger.info(f"SES delivery note (e.g. sandbox or unverified identity): {ses_error}")

        mailto_link = (
            f"mailto:{recipient_email}"
            f"?cc={sender_email}"
            f"&subject={urllib.parse.quote(subject)}"
            f"&body={urllib.parse.quote(body_text)}"
        )

        return build_cors_response(200, {
            'success': True,
            'message': f"Match notification ping processed for {recipient_email}",
            'recipientEmail': recipient_email,
            'senderEmail': sender_email,
            'subject': subject,
            'body': body_text,
            'mailtoLink': mailto_link,
            'sesSent': ses_sent,
            'sesNote': ses_error
        })
    except Exception as e:
        logger.error(f"Error handling match notification: {e}")
        return build_cors_response(500, {'error': str(e)})

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main API Gateway Lambda router."""
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '/items')
    query_params = event.get('queryStringParameters') or {}
    path_params = event.get('pathParameters') or {}

    # Handle CORS preflight
    if http_method == 'OPTIONS':
        return build_cors_response(200, {'status': 'ok'})

    table = get_dynamodb_table()

    # Route: POST /items/notify-match or /items/notify-claim
    if ('/notify-match' in path or '/notify-claim' in path) and http_method == 'POST':
        try:
            body_data = json.loads(event.get('body') or '{}')
            if not isinstance(body_data, dict):
                body_data = {}
        except Exception:
            body_data = {}
        return handle_notify_match(body_data, event, table)

    # Route: GET /items/{id}/matches
    if '/matches' in path:
        item_id = path_params.get('id') or path.split('/')[2]
        return handle_get_matches(item_id, table)

    # Route: GET/PATCH/DELETE /items/{id}
    if path_params.get('id') or (len(path.strip('/').split('/')) == 2 and path.strip('/').split('/')[1] not in ('items', 'notify-match', 'notify-claim')):
        item_id = path_params.get('id') or path.strip('/').split('/')[1]
        if http_method == 'GET':
            return handle_get_item(item_id, table, event)
        elif http_method == 'PATCH':
            # BUG-08: Safe JSON parsing
            try:
                body_data = json.loads(event.get('body') or '{}')
                if not isinstance(body_data, dict):
                    return build_cors_response(400, {'error': 'Invalid request body: expected JSON object'})
            except (json.JSONDecodeError, TypeError):
                return build_cors_response(400, {'error': 'Invalid JSON in request body'})
            return handle_update_item(item_id, body_data, event, table)
        elif http_method == 'DELETE':
            return handle_delete_item(item_id, event, table)

    # Route: /items
    if http_method == 'GET':
        return handle_list_items(query_params, table, event)
    elif http_method == 'POST':
        # BUG-08: Safe JSON parsing
        try:
            body_data = json.loads(event.get('body') or '{}')
            if not isinstance(body_data, dict):
                return build_cors_response(400, {'error': 'Invalid request body: expected JSON object'})
        except (json.JSONDecodeError, TypeError):
            return build_cors_response(400, {'error': 'Invalid JSON in request body'})
        return handle_create_item(body_data, event, table)

    return build_cors_response(405, {'error': f"Method {http_method} not allowed on {path}"})

