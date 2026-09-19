"""
CampusFind / FindIt VITC - Cognito Pre Sign-up Lambda Trigger
Strictly restricts registration to @vitstudent.ac.in email domains.
Auto-confirms verified student accounts for instant onboarding.
"""

def lambda_handler(event, context):
    print("Received Cognito Pre Sign-up Event:", event)
    
    trigger_source = event.get('triggerSource', '')
    
    # Allow Admin created users (e.g. campus safety admins, staff)
    if trigger_source == 'PreSignUp_AdminCreateUser':
        event.setdefault('response', {})
        event['response']['autoConfirmUser'] = True
        event['response']['autoVerifyEmail'] = True
        return event
    
    user_attrs = event.get('request', {}).get('userAttributes', {})
    email = user_attrs.get('email', '').strip().lower()
    
    # Enforce @vitstudent.ac.in domain restriction for public student signups
    if not email.endswith('@vitstudent.ac.in'):
        raise Exception("Access Denied: Registration is strictly restricted to valid VIT Chennai student accounts (@vitstudent.ac.in).")
    
    # Do NOT auto-confirm: Cognito will dispatch a real 6-digit verification code to the student's email
    event.setdefault('response', {})
    event['response']['autoConfirmUser'] = False
    event['response']['autoVerifyEmail'] = False
    
    return event
