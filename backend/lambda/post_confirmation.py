"""
CampusFind / FindIt VITC - Cognito Post Confirmation Lambda Trigger
Automatically subscribes newly confirmed student email accounts to the
Amazon SNS Emergency Broadcast Topic (CampusFind-EmergencyAlerts).
"""

import os
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SNS_TOPIC_ARN = os.environ.get('ALERT_TOPIC_ARN', 'arn:aws:sns:ap-south-1:694442891642:CampusFind-EmergencyAlerts')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')

def lambda_handler(event, context):
    logger.info(f"Received Cognito Post Confirmation Event: {event}")
    
    trigger_source = event.get('triggerSource', '')
    user_attrs = event.get('request', {}).get('userAttributes', {})
    email = user_attrs.get('email', '').strip().lower()
    
    if email and trigger_source in ['PostConfirmation_ConfirmSignUp', 'PostConfirmation_ConfirmForgotPassword']:
        try:
            sns = boto3.client('sns', region_name=AWS_REGION)
            response = sns.subscribe(
                TopicArn=SNS_TOPIC_ARN,
                Protocol='email',
                Endpoint=email
            )
            logger.info(f"Subscribed {email} to emergency broadcast SNS topic: {response.get('SubscriptionArn')}")
        except Exception as e:
            logger.error(f"Failed to auto-subscribe {email} to SNS topic: {e}")
            
    return event
