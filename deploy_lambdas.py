import zipfile
import io
import os
import boto3

lambda_dir = 'backend/lambda'
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(lambda_dir):
        for f in files:
            if f.endswith('.py') and not f.startswith('test_'):
                full_path = os.path.join(root, f)
                arc_name = os.path.relpath(full_path, lambda_dir)
                zf.write(full_path, arc_name)

zip_bytes = buf.getvalue()
print(f'Packaged Lambda zip: {len(zip_bytes)} bytes')

lambda_client = boto3.client('lambda', region_name='ap-south-1')
functions = [
    'campusfind-stack-UploadPresignFunction-SQLqaaJ1Nx1f',
    'campusfind-stack-ItemsFunction-EyCvEzxJrwwg',
    'campusfind-stack-AlertsFunction-ZdPNcRr770ZS',
    'campusfind-stack-RekognitionTriggerFunction-xPrt8qGuAccU',
    'campusfind-cognito-presignup-trigger',
    'campusfind-cognito-postconfirmation-trigger',
    'campusfind-cognito-custommessage-trigger'
]

for fn in functions:
    res = lambda_client.update_function_code(
        FunctionName=fn,
        ZipFile=zip_bytes
    )
    print(f"Updated {fn}: version={res.get('Version')}, lastModified={res.get('LastModified')}")
