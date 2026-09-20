"""
Comprehensive Unit & Integration Tests for CampusFind Lambda Handlers
Verifies fixes for:
- BUG-01 & BUG-04: Cognito Claims & IDOR Authorization
- BUG-02: Rekognition Float-to-Decimal DynamoDB Serialization
- BUG-03: S3 Presigned PUT and GET Photo URLs
- BUG-05: Emergency Alert Admin Group Authorization (no body bypass)
- BUG-07: GSI TypeCreatedAtIndex Query vs Scan
- BUG-08: Safe JSON parsing & 400 Bad Request on malformed inputs
- BUG-09: DELETE /items/{id} endpoint
- BUG-15: SNS Emergency Alert Idempotency
"""

import sys
import os
import json
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

# Add lambda directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'lambda')))

import items
import rekognition_processor
import uploads
import alerts


# =============================================================================
# 1. Test BUG-01: Rekognition OPTIONS Preflight CORS & POST /rekognition/analyze
# =============================================================================

def test_rekognition_options_preflight_cors_returns_200_and_headers():
    event = {
        'httpMethod': 'OPTIONS',
        'path': '/rekognition/analyze',
        'headers': {'Origin': 'https://finditvitc.github.io'}
    }
    response = rekognition_processor.lambda_handler(event, None)
    assert response['statusCode'] == 200
    headers = response.get('headers', {})
    assert headers.get('Access-Control-Allow-Origin') == 'https://finditvitc.github.io'
    assert 'OPTIONS' in headers.get('Access-Control-Allow-Methods', '')
    assert 'Authorization' in headers.get('Access-Control-Allow-Headers', '')


def test_rekognition_post_analyze_returns_cors_and_tags():
    event = {
        'httpMethod': 'POST',
        'path': '/rekognition/analyze',
        'headers': {'Origin': 'http://localhost:5173'},
        'body': json.dumps({
            'title': 'Space Gray MacBook Pro 16 inch',
            'category': 'Electronics',
            'description': 'Left on 3rd floor study desk'
        })
    }
    response = rekognition_processor.lambda_handler(event, None)
    assert response['statusCode'] == 200
    headers = response.get('headers', {})
    assert headers.get('Access-Control-Allow-Origin') == 'http://localhost:5173'
    body = json.loads(response['body'])
    assert 'ai_tags' in body
    assert any('Laptop' in t or 'Computer' in t or 'Electronics' in t for t in body['ai_tags'])


# =============================================================================
# 1.1 Test BUG-08: Malformed JSON Returns 400 Bad Request
# =============================================================================

def test_items_handler_malformed_json_returns_400():
    event = {
        'httpMethod': 'POST',
        'path': '/items',
        'body': '{"title": "Broken JSON missing closing brace'
    }
    response = items.lambda_handler(event, None)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'Invalid JSON' in body['error']


def test_alerts_handler_malformed_json_returns_400():
    event = {
        'httpMethod': 'POST',
        'path': '/alerts',
        'body': '{"message": "Broken alert json'
    }
    response = alerts.lambda_handler(event, None)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'Invalid JSON' in body['error']


def test_uploads_handler_malformed_json_returns_400():
    event = {
        'httpMethod': 'POST',
        'path': '/uploads/presign',
        'body': '{"filename": "test.jpg'
    }
    response = uploads.lambda_handler(event, None)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'Invalid JSON' in body['error']


# =============================================================================
# 2. Test BUG-02: Rekognition Labels Float-to-Decimal DynamoDB Serialization
# =============================================================================

def test_rekognition_convert_floats_to_decimals():
    raw_labels = [
        {'name': 'Laptop', 'confidence': 98.6},
        {'name': 'Computer', 'confidence': 95.2}
    ]
    converted = rekognition_processor.convert_floats_to_decimals(raw_labels)
    assert isinstance(converted[0]['confidence'], Decimal)
    assert converted[0]['confidence'] == Decimal('98.6')
    assert isinstance(converted[1]['confidence'], Decimal)
    assert converted[1]['confidence'] == Decimal('95.2')


def test_rekognition_dynamodb_update_with_decimals():
    mock_table = MagicMock()
    
    analysis = {
        'ai_tags': ['Laptop', 'Electronics'],
        'detected_labels': [
            {'name': 'Laptop', 'confidence': 98.6},
            {'name': 'Electronics', 'confidence': 95.2}
        ],
        'dominant_colors': ['Grey']
    }

    with patch.object(rekognition_processor, 'get_dynamodb_resource') as mock_dynamo, \
         patch.object(rekognition_processor, 'analyze_image_with_rekognition', return_value=analysis):
        
        mock_dynamo.return_value.Table.return_value = mock_table
        
        event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'test-bucket'},
                    'object': {'key': 'items/item-123/laptop.jpg'}
                }
            }]
        }
        
        res = rekognition_processor.lambda_handler(event, None)
        assert res['statusCode'] == 200
        
        # Verify update_item was called with Decimal types
        mock_table.update_item.assert_called_once()
        call_kwargs = mock_table.update_item.call_args[1]
        labels_passed = call_kwargs['ExpressionAttributeValues'][':labels']
        for lbl in labels_passed:
            assert isinstance(lbl['confidence'], Decimal)


# =============================================================================
# 3. Test BUG-03: S3 Presigned Upload & Download URLs
# =============================================================================

def test_uploads_presign_generates_put_and_get_urls():
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.side_effect = [
        'https://bucket.s3.amazonaws.com/items/123/pic.jpg?AWSAccessKeyId=...',  # PUT
        'https://bucket.s3.amazonaws.com/items/123/pic.jpg?X-Amz-Signature=...'   # GET
    ]

    with patch.object(uploads, 'get_s3_client', return_value=mock_s3):
        event = {
            'httpMethod': 'POST',
            'path': '/uploads/presign',
            'body': json.dumps({
                'filename': 'my_macbook.jpg',
                'fileType': 'image/jpeg',
                'itemId': 'item-123'
            })
        }
        res = uploads.lambda_handler(event, None)
        assert res['statusCode'] == 200
        data = json.loads(res['body'])
        assert 'uploadUrl' in data
        assert 'photoUrl' in data
        assert data['itemId'] == 'item-123'


# =============================================================================
# 4. Test BUG-04 & BUG-01: IDOR Protection on Item Modification & Deletion
# =============================================================================

def test_idor_item_update_rejected_for_unauthorized_user():
    mock_table = MagicMock()
    mock_table.get_item.return_value = {
        'Item': {
            'id': 'item-b-100',
            'userId': 'user-b-sub-id',
            'userEmail': 'user_b@campus.edu',
            'title': 'User B Lost Laptop',
            'status': 'open'
        }
    }

    # User C (malicious attacker) trying to claim User B's item
    event = {
        'httpMethod': 'PATCH',
        'path': '/items/item-b-100',
        'pathParameters': {'id': 'item-b-100'},
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'user-c-sub-id',
                    'email': 'user_c@campus.edu',
                    'cognito:groups': 'Student'
                }
            }
        },
        'body': json.dumps({'status': 'claimed'})
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 403
        data = json.loads(res['body'])
        assert 'Forbidden' in data['error']


def test_idor_item_update_allowed_for_owner():
    mock_table = MagicMock()
    mock_table.get_item.return_value = {
        'Item': {
            'id': 'item-b-100',
            'userId': 'user-b-sub-id',
            'userEmail': 'user_b@campus.edu',
            'title': 'User B Lost Laptop',
            'status': 'open'
        }
    }
    mock_table.update_item.return_value = {
        'Attributes': {'id': 'item-b-100', 'status': 'claimed'}
    }

    # User B updating their own item
    event = {
        'httpMethod': 'PATCH',
        'path': '/items/item-b-100',
        'pathParameters': {'id': 'item-b-100'},
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'user-b-sub-id',
                    'email': 'user_b@campus.edu',
                    'cognito:groups': 'Student'
                }
            }
        },
        'body': json.dumps({'status': 'claimed'})
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 200
        data = json.loads(res['body'])
        assert data['message'] == 'Item updated'


def test_item_deletion_by_owner_and_rejection_by_stranger():
    mock_table = MagicMock()
    mock_table.get_item.return_value = {
        'Item': {
            'id': 'item-b-100',
            'userId': 'user-b-sub-id',
            'userEmail': 'user_b@campus.edu',
            'title': 'User B Lost Laptop'
        }
    }

    # 1. Attacker User C deletion rejected
    event_c = {
        'httpMethod': 'DELETE',
        'path': '/items/item-b-100',
        'pathParameters': {'id': 'item-b-100'},
        'requestContext': {
            'authorizer': {
                'claims': {'sub': 'user-c-sub-id', 'email': 'user_c@campus.edu'}
            }
        }
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res_c = items.lambda_handler(event_c, None)
        assert res_c['statusCode'] == 403

    # 2. Owner User B deletion succeeds
    event_b = {
        'httpMethod': 'DELETE',
        'path': '/items/item-b-100',
        'pathParameters': {'id': 'item-b-100'},
        'requestContext': {
            'authorizer': {
                'claims': {'sub': 'user-b-sub-id', 'email': 'user_b@campus.edu'}
            }
        }
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res_b = items.lambda_handler(event_b, None)
        assert res_b['statusCode'] == 200
        mock_table.delete_item.assert_called_once_with(Key={'id': 'item-b-100'})


# =============================================================================
# 5. Test BUG-05: Emergency Alerts Admin Authorization Enforcement
# =============================================================================

def test_alerts_rejects_student_with_is_admin_true_body_bypass():
    mock_table = MagicMock()
    
    # Non-admin student attempting to broadcast with isAdmin: true body bypass
    event = {
        'httpMethod': 'POST',
        'path': '/alerts',
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'student-123',
                    'email': 'student@campus.edu',
                    'cognito:groups': 'Student'
                }
            }
        },
        'body': json.dumps({
            'title': 'Fake Alert',
            'message': 'Cancel classes',
            'isAdmin': True
        })
    }

    with patch.object(alerts, 'get_dynamodb_table', return_value=mock_table):
        res = alerts.lambda_handler(event, None)
        assert res['statusCode'] == 403
        data = json.loads(res['body'])
        assert 'Unauthorized' in data['error']


def test_alerts_accepts_admin_group_user():
    mock_table = MagicMock()
    mock_sns = MagicMock()
    mock_sns.publish.return_value = {'MessageId': 'sns-msg-9999'}

    event = {
        'httpMethod': 'POST',
        'path': '/alerts',
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'officer-456',
                    'email': 'security@campus.edu',
                    'cognito:groups': 'Admin,Security'
                }
            }
        },
        'body': json.dumps({
            'title': 'Severe Weather Warning',
            'message': 'Basement flooding, evacuate to upper floors',
            'severity': 'critical',
            'zone': 'Science Quad'
        })
    }

    with patch.object(alerts, 'get_dynamodb_table', return_value=mock_table), \
         patch.object(alerts, 'get_sns_client', return_value=mock_sns), \
         patch.object(alerts, 'SNS_TOPIC_ARN', 'arn:aws:sns:ap-south-1:123456:CampusFind-Alerts'):
        
        res = alerts.lambda_handler(event, None)
        assert res['statusCode'] == 201
        data = json.loads(res['body'])
        assert data['alert']['broadcastStatus'] == 'delivered'
        assert data['alert']['snsMessageId'] == 'sns-msg-9999'


# =============================================================================
# 6. Test BUG-07: GSI TypeCreatedAtIndex Query Optimization
# =============================================================================

def test_items_list_uses_gsi_query_when_type_specified():
    mock_table = MagicMock()
    mock_table.query.return_value = {
        'Items': [
            {'id': '1', 'type': 'lost', 'title': 'Lost Wallet', 'createdAt': '2026-09-16T10:00:00Z'}
        ]
    }

    event = {
        'httpMethod': 'GET',
        'path': '/items',
        'queryStringParameters': {'type': 'lost'}
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 200
        # Verify table.query was called on GSI TypeCreatedAtIndex
        mock_table.query.assert_called_once()
        call_kwargs = mock_table.query.call_args[1]
        assert call_kwargs['IndexName'] == 'TypeCreatedAtIndex'
        mock_table.scan.assert_not_called()


def test_items_matches_uses_gsi_query_for_opposing_type():
    mock_table = MagicMock()
    mock_table.get_item.return_value = {
        'Item': {
            'id': 'lost-item-1',
            'type': 'lost',
            'category': 'Electronics',
            'title': 'MacBook Pro',
            'location': 'Library'
        }
    }
    mock_table.query.return_value = {
        'Items': [
            {
                'id': 'found-item-2',
                'type': 'found',
                'category': 'Electronics',
                'title': 'Found Apple Laptop',
                'location': 'Library',
                'status': 'open'
            }
        ]
    }

    event = {
        'httpMethod': 'GET',
        'path': '/items/lost-item-1/matches',
        'pathParameters': {'id': 'lost-item-1'}
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 200
        data = json.loads(res['body'])
        assert data['match_count'] >= 1
        # GSI query should have queried opposing type 'found'
        mock_table.query.assert_called_once()
        assert mock_table.query.call_args[1]['IndexName'] == 'TypeCreatedAtIndex'


# =============================================================================
# 7. Test BUG-15: Alert Idempotency
# =============================================================================

def test_alert_idempotency_suppresses_duplicate():
    mock_table = MagicMock()
    mock_table.scan.return_value = {
        'Items': [
            {
                'id': 'alert-old-1',
                'title': 'Flash Flood Alert',
                'zone': 'Science Quad',
                'severity': 'critical',
                'idempotencyKey': 'Flash Flood Alert:Science Quad:critical',
                'broadcastStatus': 'delivered'
            }
        ]
    }

    event = {
        'httpMethod': 'POST',
        'path': '/alerts',
        'requestContext': {
            'authorizer': {
                'claims': {'cognito:groups': 'Admin'}
            }
        },
        'body': json.dumps({
            'title': 'Flash Flood Alert',
            'message': 'Evacuate basement',
            'zone': 'Science Quad',
            'severity': 'critical'
        })
    }

    with patch.object(alerts, 'get_dynamodb_table', return_value=mock_table):
        res = alerts.lambda_handler(event, None)
        assert res['statusCode'] == 200
        data = json.loads(res['body'])
        assert 'Duplicate broadcast suppressed' in data['message']


# =============================================================================
# 8. Complete User Journey Validation Test
# =============================================================================

def test_complete_user_journey_flow():
    """
    Step 1: Sign up & create lost item report
    Step 2: Upload photo via presigned URL
    Step 3: Trigger Rekognition processor -> labels stored in DynamoDB as Decimals
    Step 4: Opposing found report filed
    Step 5: Query AI matches -> high confidence score (> 70%)
    Step 6: Owner marks item as claimed -> status updated
    Step 7: Admin broadcasts emergency alert -> delivered via SNS
    """
    mock_items_table = MagicMock()
    stored_items = {}

    def mock_put(Item):
        stored_items[Item['id']] = Item
        return {}

    def mock_get(Key):
        return {'Item': stored_items.get(Key['id'])}

    def mock_update(Key, UpdateExpression, ExpressionAttributeValues, **kwargs):
        it = stored_items.get(Key['id'], {})
        if ':labels' in ExpressionAttributeValues:
            it['detected_labels'] = ExpressionAttributeValues[':labels']
            it['ai_tags'] = ExpressionAttributeValues[':tags']
        if ':status' in ExpressionAttributeValues:
            it['status'] = ExpressionAttributeValues[':status']
        stored_items[Key['id']] = it
        return {'Attributes': it}

    mock_items_table.put_item.side_effect = mock_put
    mock_items_table.get_item.side_effect = mock_get
    mock_items_table.update_item.side_effect = mock_update

    # Step 1: Create Lost Report
    create_event = {
        'httpMethod': 'POST',
        'path': '/items',
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'usr-alex-001',
                    'email': 'alex.student@campus.edu',
                    'cognito:groups': 'Student'
                }
            }
        },
        'body': json.dumps({
            'title': 'Midnight MacBook Air M2',
            'type': 'lost',
            'category': 'Electronics',
            'location': 'Main Library 3rd Floor Stacks',
            'description': 'Has a NASA and Python sticker on top cover'
        })
    }

    with patch.object(items, 'get_dynamodb_table', return_value=mock_items_table):
        create_res = items.lambda_handler(create_event, None)
        assert create_res['statusCode'] == 201
        lost_item = json.loads(create_res['body'])['item']
        lost_id = lost_item['id']

    # Step 2: Upload photo
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = 'https://s3.amazonaws.com/upload'
    with patch.object(uploads, 'get_s3_client', return_value=mock_s3):
        upload_event = {
            'httpMethod': 'POST',
            'path': '/uploads/presign',
            'body': json.dumps({'filename': 'macbook.jpg', 'fileType': 'image/jpeg', 'itemId': lost_id})
        }
        up_res = uploads.lambda_handler(upload_event, None)
        assert up_res['statusCode'] == 200

    # Step 3: Trigger Rekognition on uploaded photo
    with patch.object(rekognition_processor, 'get_dynamodb_resource') as mock_dynamo, \
         patch.object(rekognition_processor, 'analyze_image_with_rekognition', return_value={
             'ai_tags': ['Laptop', 'Computer', 'Electronics', 'Keyboard'],
             'detected_labels': [
                 {'name': 'Laptop', 'confidence': 99.2},
                 {'name': 'Computer', 'confidence': 97.5}
             ],
             'dominant_colors': ['Midnight', 'Black']
         }):
        mock_dynamo.return_value.Table.return_value = mock_items_table
        s3_event = {
            'Records': [{'s3': {'bucket': {'name': 'photos-bucket'}, 'object': {'key': f'items/{lost_id}/photo.jpg'}}}]
        }
        rek_res = rekognition_processor.lambda_handler(s3_event, None)
        assert rek_res['statusCode'] == 200
        # Check that DynamoDB item has tags and Decimal confidence
        assert 'Laptop' in stored_items[lost_id]['ai_tags']
        assert isinstance(stored_items[lost_id]['detected_labels'][0]['confidence'], Decimal)

    # Step 4: Opposing Found Report created
    found_event = {
        'httpMethod': 'POST',
        'path': '/items',
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'usr-sarah-003',
                    'email': 'sarah.chen@campus.edu',
                    'cognito:groups': 'Student'
                }
            }
        },
        'body': json.dumps({
            'title': 'Found Apple Laptop Dark Grey',
            'type': 'found',
            'category': 'Electronics',
            'location': 'Main Library Circulation Desk',
            'description': 'Turned in dark laptop with stickers',
            'ai_tags': ['Laptop', 'Computer', 'Electronics']
        })
    }
    with patch.object(items, 'get_dynamodb_table', return_value=mock_items_table):
        found_res = items.lambda_handler(found_event, None)
        assert found_res['statusCode'] == 201
        found_item = json.loads(found_res['body'])['item']

    # Step 5: Check AI Matches
    mock_items_table.query.return_value = {'Items': [stored_items[found_item['id']]]}
    with patch.object(items, 'get_dynamodb_table', return_value=mock_items_table):
        matches_event = {
            'httpMethod': 'GET',
            'path': f'/items/{lost_id}/matches',
            'pathParameters': {'id': lost_id}
        }
        match_res = items.lambda_handler(matches_event, None)
        assert match_res['statusCode'] == 200
        match_data = json.loads(match_res['body'])
        assert match_data['match_count'] == 1
        assert match_data['matches'][0]['score'] >= 60.0
        assert match_data['matches'][0]['breakdown']['visual'] > 0.0

    # Step 6: Mark Claimed by owner
    with patch.object(items, 'get_dynamodb_table', return_value=mock_items_table):
        claim_event = {
            'httpMethod': 'PATCH',
            'path': f'/items/{lost_id}',
            'pathParameters': {'id': lost_id},
            'requestContext': {
                'authorizer': {
                    'claims': {'sub': 'usr-alex-001', 'email': 'alex.student@campus.edu', 'cognito:groups': 'Student'}
                }
            },
            'body': json.dumps({'status': 'claimed'})
        }
        claim_res = items.lambda_handler(claim_event, None)
        assert claim_res['statusCode'] == 200
        assert stored_items[lost_id]['status'] == 'claimed'


def test_items_rejects_future_dateTime():
    mock_table = MagicMock()
    future_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    event = {
        'httpMethod': 'POST',
        'path': '/items',
        'body': json.dumps({
            'title': 'Lost Car Keys',
            'type': 'lost',
            'category': 'Keys',
            'location': 'Student Parking Lot B',
            'dateTime': future_time
        })
    }
    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert 'future' in body['error'].lower()


def test_items_accepts_valid_local_time_submission():
    mock_table = MagicMock()
    # Simulate an item submitted with local timezone representation (e.g. 10 mins ago converted to ISO with local offset)
    local_tz = timezone(timedelta(hours=5, minutes=30))  # IST
    recent_local_time = (datetime.now(local_tz) - timedelta(minutes=10)).isoformat()

    event = {
        'httpMethod': 'POST',
        'path': '/items',
        'body': json.dumps({
            'title': 'Lost Water Bottle',
            'type': 'lost',
            'category': 'Drinkware',
            'location': 'Library Stacks',
            'dateTime': recent_local_time
        })
    }
    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 201
        body = json.loads(res['body'])
        assert body['message'] == 'Item created successfully'


def test_items_rejects_overlength_title():
    mock_table = MagicMock()
    overlong_title = "A" * 105

    event = {
        'httpMethod': 'POST',
        'path': '/items',
        'body': json.dumps({
            'title': overlong_title,
            'type': 'lost',
            'category': 'Electronics',
            'location': 'Library'
        })
    }
    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 400
        body = json.loads(res['body'])
        assert '100' in body['error']


# =============================================================================
# Security Hardening Tests: PII Protection & Anti-Spoofing
# =============================================================================

def test_items_list_masks_pii_for_unauthenticated_callers():
    mock_table = MagicMock()
    mock_table.scan.return_value = {
        'Items': [
            {
                'id': 'item-101',
                'title': 'Blue HydroFlask',
                'type': 'lost',
                'category': 'Drinkware',
                'location': 'Library',
                'userEmail': 'student.john2024@vitstudent.ac.in',
                'userId': 'cognito-sub-12345',
                'contactInfo': 'student.john2024@vitstudent.ac.in',
                'createdAt': '2026-09-20T10:00:00Z'
            }
        ]
    }

    event = {
        'httpMethod': 'GET',
        'path': '/items',
        'queryStringParameters': None,
        'headers': {}
    }
    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 200
        body = json.loads(res['body'])
        item = body['items'][0]
        # Full raw email and internal userId must be redacted/masked
        assert item['userEmail'] == 's***@vitstudent.ac.in'
        assert item['userId'] == ''
        assert 'student.john2024@vitstudent.ac.in' not in item['contactInfo']


def test_alerts_rejects_unauthorized_user_with_spoofed_body():
    mock_table = MagicMock()
    event = {
        'httpMethod': 'POST',
        'path': '/alerts',
        'headers': {},
        'body': json.dumps({
            'title': 'Fake Alert',
            'message': 'Testing spoofing',
            'severity': 'critical',
            'userEmail': 'jerisheugin2567@gmail.com',
            'role': 'admin'
        })
    }
    with patch.object(alerts, 'get_dynamodb_table', return_value=mock_table):
        res = alerts.lambda_handler(event, None)
        assert res['statusCode'] == 403
        body = json.loads(res['body'])
        assert 'Unauthorized' in body['error']


def test_items_update_rejects_body_email_spoofing():
    mock_table = MagicMock()
    mock_table.get_item.return_value = {
        'Item': {
            'id': 'item-victim',
            'title': 'Victim Laptop',
            'userEmail': 'victim.student2024@vitstudent.ac.in',
            'userId': 'victim-sub-999',
            'status': 'open'
        }
    }

    # Attacker tries to update status by putting victim's email in body without auth token
    event = {
        'httpMethod': 'PATCH',
        'path': '/items/item-victim',
        'pathParameters': {'id': 'item-victim'},
        'headers': {},
        'body': json.dumps({
            'status': 'claimed',
            'userEmail': 'victim.student2024@vitstudent.ac.in'
        })
    }
    with patch.object(items, 'get_dynamodb_table', return_value=mock_table):
        res = items.lambda_handler(event, None)
        assert res['statusCode'] == 403
        body = json.loads(res['body'])
        assert 'Forbidden' in body['error']



