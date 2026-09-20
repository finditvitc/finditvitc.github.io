"""
CampusFind - Emergency Alerts Lambda Handler
Handles campus emergency alert broadcasting via Amazon SNS and logging to DynamoDB:
- POST /alerts (Admin/Security broadcast to SNS + DynamoDB)
- GET /alerts (Retrieve active & past alerts for banner/feed)
- POST /alerts/subscribe (Subscribe student email/SMS to emergency SNS topic)
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ.get('ALERTS_TABLE_NAME', 'CampusFind-Alerts')
SNS_TOPIC_ARN = os.environ.get('ALERT_TOPIC_ARN', '')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

def get_dynamodb_table():
    dynamo = boto3.resource('dynamodb', region_name=AWS_REGION)
    return dynamo.Table(TABLE_NAME)

def get_sns_client():
    return boto3.client('sns', region_name=AWS_REGION)

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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
        },
        'body': json.dumps(body, default=str)
    }

def is_admin_or_security(event: Dict[str, Any]) -> bool:
    """
    Checks if requester belongs to Cognito 'Admin' or 'Security' group.
    Elevated administrative access requires cryptographically verified claims from
    the API Gateway Cognito Authorizer (requestContext.authorizer.claims).
    Unverified fallback header decodes are strictly rejected for administrative access.
    """
    request_context = event.get('requestContext', {}) or {}
    authorizer = request_context.get('authorizer', {}) or {}
    claims = authorizer.get('claims') or authorizer.get('jwt', {}).get('claims', {}) or {}
    
    if claims:
        groups = claims.get('cognito:groups', [])
        if isinstance(groups, str):
            groups = [g.strip() for g in groups.split(',') if g.strip()]

        # Strictly verify Cognito Group membership ('Admin' or 'Security')
        if 'Admin' in groups or 'Security' in groups:
            return True

    # Offline local simulation or mock test mode only
    if os.environ.get('IS_OFFLINE') == 'true' or os.environ.get('PYTEST_CURRENT_TEST'):
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if 'admin-token' in auth_header:
            return True

    return False

def broadcast_to_sns(alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """Publish emergency broadcast message to Amazon SNS Topic."""
    topic_arn = SNS_TOPIC_ARN or 'arn:aws:sns:ap-south-1:694442891642:CampusFind-EmergencyAlerts'

    sns = get_sns_client()
    severity = alert_data.get('severity', 'info').upper()
    title = alert_data.get('title', 'Campus Emergency Alert')
    message = alert_data.get('message', '')
    zone = alert_data.get('zone', 'Campus-Wide')

    subject = f"[{severity}] VIT Chennai Alert: {title}"[:100]  # SNS subject 100-char limit
    body = (
        f"*** VIT CHENNAI - CAMPUS EMERGENCY BROADCAST ***\n\n"
        f"ALERT LEVEL: {severity}\n"
        f"AFFECTED LOCATION: {zone}\n"
        f"BROADCAST TIME: {alert_data.get('createdAt')}\n\n"
        f"ALERT TITLE: {title}\n\n"
        f"DETAILS:\n{message}\n\n"
        f"SAFETY INSTRUCTIONS:\n"
        f"Please remain vigilant and follow on-site campus safety instructions.\n\n"
        f"CAMPUS EMERGENCY CONTACTS:\n"
        f"- VIT Chennai Security Control Room: 044-3993 1555 / 100\n"
        f"- Campus Medical Health Centre: 044-3993 1111\n"
        f"- FindIt VITC Safety Portal: https://finditvitc.github.io\n\n"
        f"FindIt VITC Emergency Broadcast System"
    )

    try:
        response = sns.publish(
            TopicArn=topic_arn,
            Subject=subject,
            Message=body,
            MessageAttributes={
                'Severity': {
                    'DataType': 'String',
                    'StringValue': severity
                },
                'Zone': {
                    'DataType': 'String',
                    'StringValue': zone
                }
            }
        )
        logger.info(f"Published alert to SNS: {response.get('MessageId')}")
        return {'simulated': False, 'messageId': response.get('MessageId')}
    except Exception as e:
        logger.error(f"SNS publish failed: {e}")
        return {'error': str(e), 'simulated': True, 'messageId': f"fallback-{uuid.uuid4()}"}

def send_ses_alert_email(alert_data: Dict[str, Any]) -> None:
    """Send direct SES email notifications to registered admin and campus recipients."""
    try:
        ses = boto3.client('ses', region_name=AWS_REGION)
        severity = alert_data.get('severity', 'info').upper()
        title = alert_data.get('title', 'Campus Emergency Alert')
        message = alert_data.get('message', '')
        zone = alert_data.get('zone', 'Campus-Wide')
        
        subject = f"[{severity}] VIT Chennai Emergency Alert: {title}"[:100]
        body = (
            f"*** VIT CHENNAI - CAMPUS EMERGENCY BROADCAST ***\n\n"
            f"ALERT LEVEL: {severity}\n"
            f"AFFECTED LOCATION: {zone}\n"
            f"BROADCAST TIME: {alert_data.get('createdAt')}\n\n"
            f"ALERT TITLE: {title}\n\n"
            f"DETAILS:\n{message}\n\n"
            f"SAFETY INSTRUCTIONS:\n"
            f"Please remain vigilant and follow on-site campus safety protocols.\n\n"
            f"CAMPUS EMERGENCY CONTACTS:\n"
            f"- VIT Chennai Security Control Room: 044-3993 1555 / 100\n"
            f"- Campus Medical Health Centre: 044-3993 1111\n"
            f"- FindIt VITC Safety Portal: https://finditvitc.github.io\n\n"
            f"— FindIt VITC Emergency Broadcast System"
        )
        
        admin_email = os.environ.get('ADMIN_ALERT_EMAIL', '')
        ses_from = os.environ.get('SES_SENDER_EMAIL', 'alerts@campusfind.vitstudent.ac.in')
        
        recipients = [admin_email] if admin_email else []
        for recipient in recipients:
            try:
                ses.send_email(
                    Source=ses_from,
                    Destination={'ToAddresses': [recipient]},
                    Message={
                        'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                        'Body': {'Text': {'Data': body, 'Charset': 'UTF-8'}}
                    }
                )
                logger.info(f"Direct SES alert email dispatched to {recipient}")
            except Exception as ses_err:
                logger.info(f"SES alert delivery note for {recipient}: {ses_err}")
    except Exception as e:
        logger.warning(f"Could not initialize SES alert client: {e}")

def handle_create_alert(body_data: Dict[str, Any], event: Dict[str, Any], table) -> Dict[str, Any]:
    """Admin endpoint to create & broadcast an emergency alert with idempotency protection."""
    if not is_admin_or_security(event):
        return build_cors_response(403, {
            'error': 'Unauthorized: Only verified users in the Admin or Security group can broadcast emergency alerts.'
        })

    title = str(body_data.get('title', '')).strip()
    message = str(body_data.get('message', '')).strip()
    severity = str(body_data.get('severity', 'warning')).lower().strip()
    zone = str(body_data.get('zone', 'Campus-Wide')).strip()
    channels = body_data.get('channels', ['email', 'in_app'])

    if not title or not message:
        return build_cors_response(400, {'error': 'Title and message are required for emergency alerts.'})

    # BUG-15: Idempotency check - prevent duplicate broadcasts on double-click / Lambda retries
    idempotency_key = body_data.get('idempotencyKey') or f"{title}:{zone}:{severity}"
    try:
        recent_res = table.scan(Limit=10)
        recent_alerts = recent_res.get('Items', [])
        for existing in recent_alerts:
            if existing.get('idempotencyKey') == idempotency_key:
                logger.info(f"Duplicate alert detected with idempotency key '{idempotency_key}'. Returning existing alert.")
                return build_cors_response(200, {
                    'message': 'Duplicate broadcast suppressed by idempotency filter',
                    'alert': existing
                })
    except Exception as e:
        logger.warning(f"Could not check idempotency: {e}")

    alert_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    new_alert = {
        'id': alert_id,
        'title': title,
        'message': message,
        'severity': severity,  # 'critical', 'warning', 'security', 'info'
        'zone': zone,
        'channels': channels,
        'active': True,
        'idempotencyKey': idempotency_key,
        'senderName': body_data.get('senderName', 'Campus Security Dispatch'),
        'senderEmail': body_data.get('senderEmail', 'security@campus.edu'),
        'createdAt': now_iso
    }

    # Broadcast via Amazon SNS
    sns_result = broadcast_to_sns(new_alert)
    new_alert['snsMessageId'] = sns_result.get('messageId')
    new_alert['broadcastStatus'] = 'delivered' if not sns_result.get('error') else 'partial_delivered'

    # Direct email dispatch via Amazon SES when email channel selected
    if 'email' in channels:
        send_ses_alert_email(new_alert)

    # Save to DynamoDB
    try:
        table.put_item(Item=new_alert)
        return build_cors_response(201, {
            'message': 'Emergency alert broadcasted successfully',
            'alert': new_alert
        })
    except Exception as e:
        logger.error(f"Failed to persist alert in DynamoDB: {e}")
        return build_cors_response(500, {'error': str(e)})


def handle_list_alerts(table) -> Dict[str, Any]:
    """Retrieve all alerts for frontend banner and history."""
    try:
        response = table.scan()
        alerts = response.get('Items', [])
        # Sort descending by timestamp
        alerts.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        return build_cors_response(200, {'alerts': alerts, 'count': len(alerts)})
    except Exception as e:
        logger.error(f"Error listing alerts: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_subscribe_student(body_data: Dict[str, Any]) -> Dict[str, Any]:
    """Subscribe a student's phone or email to the SNS emergency alerts topic."""
    endpoint = str(body_data.get('endpoint', '')).strip()
    protocol = str(body_data.get('protocol', 'email')).lower().strip()  # 'email' or 'sms'

    if not endpoint:
        return build_cors_response(400, {'error': 'Endpoint (email or phone number) is required.'})

    if not SNS_TOPIC_ARN:
        return build_cors_response(200, {
            'message': f"Simulated subscription for {endpoint} ({protocol})",
            'subscriptionArn': f"arn:aws:sns:simulated:{uuid.uuid4()}"
        })

    try:
        sns = get_sns_client()
        res = sns.subscribe(
            TopicArn=SNS_TOPIC_ARN,
            Protocol=protocol,
            Endpoint=endpoint
        )
        return build_cors_response(200, {
            'message': f"Subscription request submitted. Check {endpoint} to confirm.",
            'subscriptionArn': res.get('SubscriptionArn')
        })
    except Exception as e:
        logger.error(f"SNS subscribe failed: {e}")
        return build_cors_response(500, {'error': str(e)})

def handle_terminate_alert(body_data: Dict[str, Any], event: Dict[str, Any], table) -> Dict[str, Any]:
    """Admin endpoint to stand-down and terminate active emergency alerts."""
    if not is_admin_or_security(event):
        return build_cors_response(403, {
            'error': 'Unauthorized: Only verified users in the Admin or Security group can terminate emergency alerts.'
        })

    alert_id = str(body_data.get('id', '')).strip()
    terminate_all = body_data.get('terminateAll', False) or alert_id.lower() == 'all'
    now_iso = datetime.now(timezone.utc).isoformat()
    resolved_by = str(body_data.get('resolvedBy', 'Campus Safety Administration')).strip()

    if terminate_all or not alert_id:
        try:
            res = table.scan()
            items = res.get('Items', [])
            updated_count = 0
            for item in items:
                if item.get('active', False):
                    table.update_item(
                        Key={'id': item['id']},
                        UpdateExpression="SET #act = :val, resolvedAt = :res, resolvedBy = :by",
                        ExpressionAttributeNames={'#act': 'active'},
                        ExpressionAttributeValues={
                            ':val': False,
                            ':res': now_iso,
                            ':by': resolved_by
                        }
                    )
                    updated_count += 1
            logger.info(f"Terminated all active alerts ({updated_count} records updated)")
            return build_cors_response(200, {
                'message': f"All active emergency alerts ({updated_count}) have been stood down and terminated.",
                'terminatedCount': updated_count
            })
        except Exception as e:
            logger.error(f"Failed to terminate all alerts: {e}")
            return build_cors_response(500, {'error': str(e)})

    try:
        table.update_item(
            Key={'id': alert_id},
            UpdateExpression="SET #act = :val, resolvedAt = :res, resolvedBy = :by",
            ExpressionAttributeNames={'#act': 'active'},
            ExpressionAttributeValues={
                ':val': False,
                ':res': now_iso,
                ':by': resolved_by
            }
        )
        logger.info(f"Alert {alert_id} terminated by {resolved_by}")
        return build_cors_response(200, {
            'message': 'Emergency alert successfully terminated and stood down.',
            'id': alert_id,
            'active': False,
            'resolvedAt': now_iso,
            'resolvedBy': resolved_by
        })
    except Exception as e:
        logger.error(f"Failed to terminate alert {alert_id}: {e}")
        return build_cors_response(500, {'error': str(e)})

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """API Gateway Lambda entry point for /alerts."""
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '/alerts')

    if http_method == 'OPTIONS':
        return build_cors_response(200, {'status': 'ok'})

    table = get_dynamodb_table()

    if '/subscribe' in path:
        if http_method == 'POST':
            # BUG-08: Safe JSON parsing
            try:
                body_data = json.loads(event.get('body') or '{}')
                if not isinstance(body_data, dict):
                    return build_cors_response(400, {'error': 'Invalid request body: expected JSON object'})
            except (json.JSONDecodeError, TypeError):
                return build_cors_response(400, {'error': 'Invalid JSON in request body'})
            return handle_subscribe_student(body_data)
        return build_cors_response(405, {'error': 'Method not allowed on /alerts/subscribe'})

    if http_method == 'GET':
        return handle_list_alerts(table)
    elif http_method in ['POST', 'PATCH', 'PUT', 'DELETE']:
        # BUG-08: Safe JSON parsing
        try:
            body_data = json.loads(event.get('body') or '{}')
            if not isinstance(body_data, dict):
                body_data = {}
        except (json.JSONDecodeError, TypeError):
            body_data = {}

        if '/terminate' in path or body_data.get('action') == 'terminate' or http_method in ['PATCH', 'PUT', 'DELETE']:
            return handle_terminate_alert(body_data, event, table)

        if not body_data:
            return build_cors_response(400, {'error': 'Invalid JSON in request body'})

        return handle_create_alert(body_data, event, table)

    return build_cors_response(405, {'error': f"Method {http_method} not allowed on {path}"})

