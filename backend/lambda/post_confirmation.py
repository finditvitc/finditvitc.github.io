"""
CampusFind / FindIt VITC - Cognito Post Confirmation Lambda Trigger
1. Automatically assigns confirmed users to their designated Cognito Group ('Student' or 'Admin').
2. Automatically subscribes confirmed student emails to the Amazon SNS Emergency Broadcast Topic.
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
    user_pool_id = event.get('userPoolId', '')
    username = event.get('userName', '')
    user_attrs = event.get('request', {}).get('userAttributes', {})
    email = user_attrs.get('email', '').strip().lower()
    
    if trigger_source in ['PostConfirmation_ConfirmSignUp', 'PostConfirmation_ConfirmForgotPassword']:
        cognito = boto3.client('cognito-idp', region_name=AWS_REGION)
        
        # 1. Automatic Group Assignment (Student vs Admin)
        role = str(user_attrs.get('custom:role', '')).lower()
        if email == 'jerisheugin2567@gmail.com' or role in ['admin', 'security', 'campus_police']:
            target_group = 'Admin'
        else:
            target_group = 'Student'
            
        try:
            cognito.admin_add_user_to_group(
                UserPoolId=user_pool_id,
                Username=username,
                GroupName=target_group
            )
            logger.info(f"Successfully auto-assigned {username} ({email}) to '{target_group}' group.")
        except Exception as e:
            logger.error(f"Failed to auto-assign {username} to group '{target_group}': {e}")

        # 2. Automatic Emergency Alerts SNS Subscription
        if email:
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
