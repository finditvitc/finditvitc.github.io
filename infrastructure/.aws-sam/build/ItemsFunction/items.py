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
from datetime import datetime
from typing import Dict, Any, List
import boto3
from boto3.dynamodb.conditions import Key, Attr

# Import AI matching engine
try:
    from matching_engine import find_matches_for_item
except ImportError:
    from .matching_engine import find_matches_for_item

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ.get('ITEMS_TABLE_NAME', 'CampusFind-Items')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

def get_dynamodb_table():
    dynamo = boto3.resource('dynamodb', region_name=AWS_REGION)
    return dynamo.Table(TABLE_NAME)

def build_cors_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
        },
        'body': json.dumps(body, default=str)
    }

def get_user_from_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Extract user claims from Cognito Authorizer if present."""
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    return {
        'userId': claims.get('sub', 'anonymous-user'),
        'email': claims.get('email', ''),
        'groups': claims.get('cognito:groups', [])
    }

def handle_list_items(query_params: Dict[str, str], table) -> Dict[str, Any]:
    """Query items from DynamoDB with flexible filtering."""
    item_type = query_params.get('type')
    category = query_params.get('category')
    location = query_params.get('location')
    status = query_params.get('status')
    user_id = query_params.get('userId')
    search = query_params.get('search', '').lower().strip()

    filter_exp = None

    if item_type and item_type.lower() != 'all':
        filter_exp = Attr('type').eq(item_type.lower())

    if category and category.lower() != 'all':
        cat_exp = Attr('category').eq(category)
        filter_exp = filter_exp & cat_exp if filter_exp else cat_exp

    if status and status.lower() != 'all':
        status_exp = Attr('status').eq(status.lower())
        filter_exp = filter_exp & status_exp if filter_exp else status_exp

    if user_id:
        user_exp = Attr('userId').eq(user_id)
        filter_exp = filter_exp & user_exp if filter_exp else user_exp

    # DynamoDB scan with filter
    scan_kwargs = {}
    if filter_exp:
        scan_kwargs['FilterExpression'] = filter_exp

    try:
        response = table.scan(**scan_kwargs)
        items = response.get('Items', [])
        
        # In-memory search filtering for fuzzy matching across title, desc, ai_tags, location
        if search:
            filtered = []
            for it in items:
                title = it.get('title', '').lower()
                desc = it.get('description', '').lower()
                loc = it.get('location', '').lower()
                tags = [t.lower() for t in it.get('ai_tags', [])]
                if (search in title or search in desc or search in loc or any(search in t for t in tags)):
                    filtered.append(it)
            items = filtered

        # Sort by createdAt descending
        items.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return build_cors_response(200, {'items': items, 'count': len(items)})

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

    item_id = str(uuid.uuid4())
    now_iso = datetime.utcnow().isoformat() + 'Z'

    new_item = {
        'id': item_id,
        'title': body_data['title'].strip(),
        'type': body_data['type'].lower().strip(),  # 'lost' or 'found'
        'category': body_data['category'].strip(),
        'location': body_data['location'].strip(),
        'dateTime': body_data.get('dateTime', now_iso),
        'description': body_data.get('description', '').strip(),
        'photoUrl': body_data.get('photoUrl', ''),
        'ai_tags': body_data.get('ai_tags', []),
        'detected_labels': body_data.get('detected_labels', []),
        'status': 'open',
        'contactInfo': body_data.get('contactInfo', user['email'] or 'Contact via campus security'),
        'userId': body_data.get('userId') or user['userId'],
        'userEmail': body_data.get('userEmail') or user['email'],
        'createdAt': now_iso,
        'updatedAt': now_iso
    }

    try:
        table.put_item(Item=new_item)
        logger.info(f"Created item {item_id} ({new_item['type']})")
        return build_cors_response(201, {'message': 'Item created successfully', 'item': new_item})
    except Exception as e:
        logger.error(f"Error creating item: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_get_item(item_id: str, table) -> Dict[str, Any]:
    """Retrieve single item by ID."""
    try:
        response = table.get_item(Key={'id': item_id})
        item = response.get('Item')
        if not item:
            return build_cors_response(404, {'error': f"Item '{item_id}' not found"})
        return build_cors_response(200, {'item': item})
    except Exception as e:
        logger.error(f"Error retrieving item {item_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_update_item(item_id: str, body_data: Dict[str, Any], table) -> Dict[str, Any]:
    """Update item status (open, claimed, resolved)."""
    status = body_data.get('status')
    if not status or status.lower() not in ['open', 'claimed', 'resolved']:
        return build_cors_response(400, {'error': "Invalid status. Must be 'open', 'claimed', or 'resolved'"})

    now_iso = datetime.utcnow().isoformat() + 'Z'
    try:
        response = table.update_item(
            Key={'id': item_id},
            UpdateExpression="SET #st = :status, updatedAt = :updated",
            ExpressionAttributeNames={'#st': 'status'},
            ExpressionAttributeValues={':status': status.lower(), ':updated': now_iso},
            ReturnValues="ALL_NEW"
        )
        return build_cors_response(200, {'message': 'Item updated', 'item': response.get('Attributes')})
    except Exception as e:
        logger.error(f"Error updating item {item_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_get_matches(item_id: str, table) -> Dict[str, Any]:
    """Compute and return AI match suggestions for a specific item."""
    try:
        target_res = table.get_item(Key={'id': item_id})
        target_item = target_res.get('Item')
        if not target_item:
            return build_cors_response(404, {'error': f"Item '{item_id}' not found"})

        # Query all items to find opposing candidates
        opposing_type = 'found' if target_item.get('type') == 'lost' else 'lost'
        candidates_res = table.scan(
            FilterExpression=Attr('type').eq(opposing_type) & Attr('status').ne('resolved')
        )
        candidates = candidates_res.get('Items', [])

        # Run AI matching algorithm
        matches = find_matches_for_item(target_item, candidates, min_score=20.0)

        return build_cors_response(200, {
            'target_item': target_item,
            'matches': matches,
            'match_count': len(matches)
        })
    except Exception as e:
        logger.error(f"Error computing matches for {item_id}: {e}")
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

    # Route: GET /items/{id}/matches
    if '/matches' in path:
        item_id = path_params.get('id') or path.split('/')[2]
        return handle_get_matches(item_id, table)

    # Route: GET/PATCH /items/{id}
    if path_params.get('id') or (len(path.strip('/').split('/')) == 2 and path.strip('/').split('/')[1] != 'items'):
        item_id = path_params.get('id') or path.strip('/').split('/')[1]
        if http_method == 'GET':
            return handle_get_item(item_id, table)
        elif http_method == 'PATCH':
            body_data = json.loads(event.get('body') or '{}')
            return handle_update_item(item_id, body_data, table)

    # Route: /items
    if http_method == 'GET':
        return handle_list_items(query_params, table)
    elif http_method == 'POST':
        body_data = json.loads(event.get('body') or '{}')
        return handle_create_item(body_data, event, table)

    return build_cors_response(405, {'error': f"Method {http_method} not allowed on {path}"})
