import boto3
import zipfile
import io

def setup_trigger():
    region = 'ap-south-1'
    lambda_client = boto3.client('lambda', region_name=region)
    cognito = boto3.client('cognito-idp', region_name=region)
    iam = boto3.client('iam')
    
    user_pool_id = 'ap-south-1_K5c6MntVx'
    fn_name = 'campusfind-cognito-presignup-trigger'
    
    # 1. Package pre_signup.py into zip
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        with open('backend/lambda/pre_signup.py', 'r', encoding='utf-8') as f:
            z.writestr('pre_signup.py', f.read())
    zip_bytes = buf.getvalue()
    
    # 2. Get execution role ARN (use existing lambda role)
    roles = iam.list_roles()['Roles']
    lambda_role = next((r for r in roles if 'ItemsFunctionRole' in r['RoleName'] or 'UploadPresign' in r['RoleName'] or 'lambda' in r['RoleName'].lower()), None)
    role_arn = lambda_role['Arn'] if lambda_role else 'arn:aws:iam::694442891642:role/campusfind-stack-ItemsFunctionRole-3L3N780G171C'
    
    # 3. Create or update Lambda function
    try:
        fn_res = lambda_client.create_function(
            FunctionName=fn_name,
            Runtime='python3.11',
            Role=role_arn,
            Handler='pre_signup.lambda_handler',
            Code={'ZipFile': zip_bytes},
            Description='Cognito Pre Sign-up trigger for FindIt VITC - restricts to @vitstudent.ac.in',
            Timeout=10,
            MemorySize=128
        )
        fn_arn = fn_res['FunctionArn']
        print(f"Created Lambda function {fn_name}: {fn_arn}")
    except lambda_client.exceptions.ResourceConflictException:
        lambda_client.update_function_code(
            FunctionName=fn_name,
            ZipFile=zip_bytes
        )
        fn_info = lambda_client.get_function(FunctionName=fn_name)
        fn_arn = fn_info['Configuration']['FunctionArn']
        print(f"Updated existing Lambda function {fn_name}: {fn_arn}")
        
    # 4. Add Lambda invoke permission for Cognito
    try:
        lambda_client.add_permission(
            FunctionName=fn_name,
            StatementId='cognito-presignup-permission',
            Action='lambda:InvokeFunction',
            Principal='cognito-idp.amazonaws.com',
            SourceArn=f"arn:aws:cognito-idp:{region}:694442891642:userpool/{user_pool_id}"
        )
        print("Added Cognito invoke permission on Lambda")
    except lambda_client.exceptions.ResourceConflictException:
        print("Cognito invoke permission already exists")
        
    # 5. Wire trigger to Cognito User Pool
    pool_desc = cognito.describe_user_pool(UserPoolId=user_pool_id)['UserPool']
    lambda_config = pool_desc.get('LambdaConfig', {})
    lambda_config['PreSignUp'] = fn_arn
    
    cognito.update_user_pool(
        UserPoolId=user_pool_id,
        LambdaConfig=lambda_config,
        AutoVerifiedAttributes=pool_desc.get('AutoVerifiedAttributes', ['email'])
    )
    print(f"Successfully wired PreSignUp trigger to Cognito User Pool {user_pool_id}!")

if __name__ == '__main__':
    setup_trigger()
