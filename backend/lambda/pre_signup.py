"""
CampusFind / FindIt VITC - Cognito Pre Sign-up Lambda Trigger
Strictly restricts registration to @vitstudent.ac.in email domains.
Auto-confirms verified student accounts for instant onboarding.
"""

def lambda_handler(event, context):
    print("Received Cognito Pre Sign-up Event:", event)
    
    user_attrs = event.get('request', {}).get('userAttributes', {})
    email = user_attrs.get('email', '').strip().lower()
    
    # Enforce @vitstudent.ac.in domain restriction
    if not email.endswith('@vitstudent.ac.in'):
        raise Exception("Access Denied: Registration is strictly restricted to valid VIT Chennai student accounts (@vitstudent.ac.in).")
    
    # Auto-confirm user and mark email as verified
    event.setdefault('response', {})
    event['response']['autoConfirmUser'] = True
    event['response']['autoVerifyEmail'] = True
    
    return event
