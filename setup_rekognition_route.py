import boto3

def setup():
    apigw = boto3.client('apigateway', region_name='ap-south-1')
    lambda_client = boto3.client('lambda', region_name='ap-south-1')

    # 1. Get Rest API
    apis = apigw.get_rest_apis()['items']
    rest_api = next((a for a in apis if 'campusfind' in a['name'].lower()), None)
    if not rest_api:
        print('Rest API not found')
        return
    rest_id = rest_api['id']
    print(f'Found API: {rest_id}')

    resources = apigw.get_resources(restApiId=rest_id)['items']
    root_res = next(r for r in resources if r['path'] == '/')
    root_id = root_res['id']

    # 2. Create /rekognition
    rek_res = next((r for r in resources if r['path'] == '/rekognition'), None)
    if not rek_res:
        rek_res = apigw.create_resource(restApiId=rest_id, parentId=root_id, pathPart='rekognition')
        print(f'Created /rekognition resource: {rek_res["id"]}')
    else:
        print(f'Found existing /rekognition: {rek_res["id"]}')

    # 3. Create /rekognition/analyze
    resources = apigw.get_resources(restApiId=rest_id)['items']
    analyze_res = next((r for r in resources if r['path'] == '/rekognition/analyze'), None)
    if not analyze_res:
        analyze_res = apigw.create_resource(restApiId=rest_id, parentId=rek_res['id'], pathPart='analyze')
        print(f'Created /rekognition/analyze resource: {analyze_res["id"]}')
    else:
        print(f'Found existing /rekognition/analyze: {analyze_res["id"]}')

    analyze_id = analyze_res['id']

    # 4. Put OPTIONS method on /rekognition/analyze
    try:
        apigw.put_method(
            restApiId=rest_id,
            resourceId=analyze_id,
            httpMethod='OPTIONS',
            authorizationType='NONE'
        )
    except Exception as e:
        print(f'OPTIONS put_method note: {e}')

    apigw.put_integration(
        restApiId=rest_id,
        resourceId=analyze_id,
        httpMethod='OPTIONS',
        type='MOCK',
        requestTemplates={'application/json': '{"statusCode": 200}'}
    )

    try:
        apigw.put_method_response(
            restApiId=rest_id,
            resourceId=analyze_id,
            httpMethod='OPTIONS',
            statusCode='200',
            responseParameters={
                'method.response.header.Access-Control-Allow-Headers': True,
                'method.response.header.Access-Control-Allow-Methods': True,
                'method.response.header.Access-Control-Allow-Origin': True
            }
        )
    except Exception as e:
        print(f'OPTIONS put_method_response note: {e}')

    apigw.put_integration_response(
        restApiId=rest_id,
        resourceId=analyze_id,
        httpMethod='OPTIONS',
        statusCode='200',
        responseParameters={
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
            'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
            'method.response.header.Access-Control-Allow-Origin': "'*'"
        }
    )
    print('Configured OPTIONS with CORS headers on /rekognition/analyze')

    # 5. Put POST method with AWS_PROXY to UploadPresignFunction
    fn_name = 'campusfind-stack-UploadPresignFunction-SQLqaaJ1Nx1f'
    fn_info = lambda_client.get_function(FunctionName=fn_name)
    fn_arn = fn_info['Configuration']['FunctionArn']

    try:
        apigw.put_method(
            restApiId=rest_id,
            resourceId=analyze_id,
            httpMethod='POST',
            authorizationType='NONE'
        )
    except Exception as e:
        print(f'POST put_method note: {e}')

    uri = f'arn:aws:apigateway:ap-south-1:lambda:path/2015-03-31/functions/{fn_arn}/invocations'
    apigw.put_integration(
        restApiId=rest_id,
        resourceId=analyze_id,
        httpMethod='POST',
        type='AWS_PROXY',
        integrationHttpMethod='POST',
        uri=uri
    )
    print('Configured POST integration with Lambda')

    # 6. Grant Lambda permission for API Gateway
    try:
        lambda_client.add_permission(
            FunctionName=fn_name,
            StatementId=f'apigateway-rekognition-analyze-{rest_id}',
            Action='lambda:InvokeFunction',
            Principal='apigateway.amazonaws.com',
            SourceArn=f'arn:aws:execute-api:ap-south-1:694442891642:{rest_id}/*/*/rekognition/analyze'
        )
        print('Added Lambda invoke permission')
    except Exception as e:
        print(f'Lambda permission note: {e}')

    # 7. Create Deployment
    apigw.create_deployment(restApiId=rest_id, stageName='prod')
    print('Successfully deployed API Gateway stage prod!')

if __name__ == '__main__':
    setup()
