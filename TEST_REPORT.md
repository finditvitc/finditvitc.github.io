# Comprehensive Verification & Test Report: Campus Lost & Found + Emergency Alert System (CampusFind)

**Target Environment:** AWS Region `ap-south-1` (Mumbai)  
**CloudFormation Stack:** `campusfind-stack`  
**API Gateway URL:** `https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod`  
**Cognito User Pool ID:** `ap-south-1_K5c6MntVx` (App Client: `5068gn9iktlj9670vdntdn125m`)  
**S3 Photos Bucket:** `campusfind-photos-694442891642-ap-south-1`  
**DynamoDB Tables:** `CampusFind-Items`, `CampusFind-Alerts`  
**SNS Topic:** `arn:aws:sns:ap-south-1:694442891642:CampusFind-EmergencyAlerts`  
**Date of Audit:** September 16, 2026  

---

## 1. Executive Summary & Verification Matrix

This report details the architectural audit and live end-to-end verification of the Campus Lost & Found and Emergency Alert System (**CampusFind**). The audit evaluated both code implementation and live AWS cloud resources to determine **what actually works vs. what only appears to work**.

| Service Domain | Verification Scope | Status | Reality vs. Appearance Summary |
| :--- | :--- | :---: | :--- |
| **1. Authentication (Cognito)** | User Sign-up, Admin Confirmation, Password Auth, Refresh Token, Route Protection | **FAIL** (Critical Security Risk) | Cognito User Pool functions for user management, but **API Gateway routes have `authorizationType: NONE`**. Anyone can create, read, and mutate records without a token. Frontend uses mock user state in `localStorage` instead of Cognito SDK. |
| **2. Storage (Amazon S3)** | Presigned PUT URL, Direct Upload, Public Access Block, MIME type validation | **PARTIAL PASS / FAIL** | Presigned PUT generation and S3 upload work. However, the system returns **direct S3 object URLs** (`https://bucket.s3.amazonaws.com/...`), which **fail with 403 Forbidden** because S3 Public Access Block is enabled and no presigned GET / CloudFront is configured. |
| **3. Event Trigger & AI (S3 → Rekognition)** | S3 ObjectCreated Event, Lambda Invocation, Rekognition DetectLabels, DynamoDB Tag Storage | **FAIL** (Silent Failure) | S3 successfully triggers `RekognitionTriggerFunction`, and Rekognition detects labels. However, DynamoDB update **crashes on Python `float` confidence scores** (`Float types are not supported. Use Decimal types instead`). The error is **silently caught**, so AI tags are **NEVER saved to DynamoDB**. |
| **4. Persistence (DynamoDB)** | CRUD operations, Partition/Sort Key design, GSI usage, Query vs Scan | **PARTIAL PASS** | Item creation, retrieval, and status updates work. However, `DELETE` is not implemented in API Gateway, and **all list/filter/match operations perform unindexed full table `table.scan()`**, completely ignoring the defined GSI (`TypeCreatedAtIndex`). |
| **5. Notifications (SNS)** | Emergency Alert Broadcast, Topic Publishing, Email Subscription, Idempotency | **PASS** (Minor Idempotency Gap) | Alerts publish to SNS and persist to `CampusFind-Alerts` DynamoDB table. Subscription workflow creates `PendingConfirmation`. No deduplication mechanism exists on Lambda retry. |
| **6. API Gateway** | CORS, Error Handling, Payload Limits, Input Sanitization | **FAIL** (Robustness Gap) | CORS preflight works. However, sending malformed JSON triggers an unhandled `JSONDecodeError` causing a **502 Bad Gateway**. Text fields accept raw injection/XSS strings without validation. |
| **7. IAM & Cost Hygiene** | Least Privilege, Resource Wildcards, CloudWatch Retentions, S3 Lifecycle | **FAIL** (Cost Leak) | CloudWatch Log Groups have **`Never Expire` (infinite retention)**. S3 has **no lifecycle rules**. Presign Lambda has unneeded `s3:PutLifecycleConfiguration` permissions, and Rekognition Lambda has unneeded `sns:Publish` permissions. |

---

## 2. Codebase Architecture & Resource Mapping

### 2.1 Route, Lambda, and AWS Resource Map

```
+---------------------------------------------------------------------------------------------------------------+
|                                                CLIENT / FRONTEND                                              |
+---------------------------------------------------------------------------------------------------------------+
                                | (HTTP REST)
                                v
+---------------------------------------------------------------------------------------------------------------+
|                                      AMAZON API GATEWAY: CampusFindApi                                        |
|                          (Base: https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod)                 |
+---------------------------------------------------------------------------------------------------------------+
  |-- GET    /items             -> ItemsFunction             -> DynamoDB: CampusFind-Items (Full Table Scan)
  |-- POST   /items             -> ItemsFunction             -> DynamoDB: CampusFind-Items (PutItem)
  |-- GET    /items/{id}        -> ItemsFunction             -> DynamoDB: CampusFind-Items (GetItem)
  |-- PATCH  /items/{id}        -> ItemsFunction             -> DynamoDB: CampusFind-Items (UpdateItem)
  |-- GET    /items/{id}/matches-> ItemsFunction             -> DynamoDB: CampusFind-Items (Full Table Scan)
  |-- GET    /alerts            -> AlertsFunction            -> DynamoDB: CampusFind-Alerts (Full Table Scan)
  |-- POST   /alerts            -> AlertsFunction            -> SNS: CampusFind-EmergencyAlerts + DynamoDB
  |-- POST   /alerts/subscribe  -> AlertsFunction            -> SNS: CampusFind-EmergencyAlerts (Subscribe)
  |-- POST   /uploads/presign   -> UploadPresignFunction     -> S3: Generate Presigned PUT URL
+---------------------------------------------------------------------------------------------------------------+
                                                                |
                                                                | (Direct Client PUT)
                                                                v
+---------------------------------------------------------------------------------------------------------------+
|                                            AMAZON S3: PhotosBucket                                            |
|                               (campusfind-photos-694442891642-ap-south-1)                                     |
+---------------------------------------------------------------------------------------------------------------+
                                                                |
                                                                | (s3:ObjectCreated:* on items/*)
                                                                v
+---------------------------------------------------------------------------------------------------------------+
|                                      LAMBDA: RekognitionTriggerFunction                                       |
|                                                                                                               |
|   1. S3 ObjectCreated event triggers Lambda                                                                   |
|   2. Calls rekognition:DetectLabels on S3 image                                                               |
|   3. Attempts DynamoDB update on CampusFind-Items -> FAILS SILENTLY (Float TypeError)                         |
+---------------------------------------------------------------------------------------------------------------+
```

### 2.2 Referenced in Code vs. Missing in Config / IaC Discrepancies

1. **Missing Authorizer Association in `template.yaml`**:
   - In `infrastructure/template.yaml`, `CampusFindApi` defines `CognitoAuth` under `Auth.Authorizers`.
   - However, **neither `DefaultAuthorizer: CognitoAuth` is configured on the API, nor is `Auth: { Authorizer: CognitoAuth }` attached to any individual API event**.
   - As a result, CloudFormation deploys every single route with `authorizationType: NONE`.
2. **Missing Local Server Routes in Cloud Deployment**:
   - `backend/local_server.py` defines `GET /api/auth/demo-users`, `POST /api/uploads/photo`, and `POST /api/rekognition/analyze`.
   - These routes **do not exist in API Gateway or `template.yaml`**.
   - Frontend `api.js` has branching logic: when switching to AWS, `GET /auth/demo-users` fails unless local mock mode is used.
3. **No `DELETE` Route in `template.yaml` or `items.py`**:
   - `build_cors_response()` returns `Access-Control-Allow-Methods: 'GET, POST, PATCH, OPTIONS, DELETE'`.
   - However, neither `template.yaml` nor `items.py` contains a handler for `DELETE /items/{id}`. Calling `DELETE /items/{id}` returns `403 Forbidden` from API Gateway.
4. **Hardcoded Regions and Names**:
   - Default region `'us-east-1'` is hardcoded as fallback in `backend/lambda/items.py` (L30), `alerts.py` (L22), `uploads.py` (L18), and `rekognition_processor.py` (L21), while the live stack is in `ap-south-1`.
   - Hardcoded simulation tag dictionary `MOCK_VISUAL_TAG_SETS` in `rekognition_processor.py` invents artificial labels on failure instead of propagating genuine Rekognition outcomes.
   - Frontend `api.js` hardcodes `token = 'admin-token'` (L130) and sends `isAdmin: true` in request bodies.

---

## 3. End-to-End Test Results & Live Evidence

### 3.1 Domain 1: Authentication & Authorization (Amazon Cognito)

#### Test Cases Executed:
1. **User Sign Up & Admin Confirmation**:
   - User B (`user_b_748914@testcampus.edu`) and User C (`user_c_098124@testcampus.edu`) registered and confirmed via Cognito API.
2. **User Authentication & Refresh Token**:
   - `initiate_auth` with `USER_PASSWORD_AUTH` returned valid ID Token, Access Token, and Refresh Token.
   - `initiate_auth` with `REFRESH_TOKEN_AUTH` successfully issued refreshed ID Token.
3. **Protected Route Security Verification**:
   - **(a) No Token:** Called `POST /items` without `Authorization` header.
   - **(b) Tampered Token:** Called `POST /items` with fake JWT signature `Bearer eyJhbGci...tampered_signature`.
   - **(c) Insecure Direct Object Reference (IDOR):** User C called `PATCH /items/{user_b_item_id}` to claim User B's item.

#### Evidence:
```json
// Test (a) Request without Authorization Token:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items
Headers: { "Content-Type": "application/json" }
Body: {
  "title": "User B Lost MacBook Pro",
  "type": "lost",
  "category": "Electronics",
  "location": "Science Quad",
  "userId": "71a3fd5a-2051-70d0-ae24-7a366e917264",
  "userEmail": "user_b_748914@testcampus.edu"
}

// Actual Response (FAILED SECURITY CHECK: 201 Created instead of 401 Unauthorized):
HTTP/1.1 201 Created
{
  "message": "Item created successfully",
  "item": {
    "id": "4a0c446c-e248-4757-8c7c-ac8787688255",
    "title": "User B Lost MacBook Pro",
    "type": "lost",
    "category": "Electronics",
    "location": "Science Quad",
    "status": "open",
    "userId": "71a3fd5a-2051-70d0-ae24-7a366e917264",
    "createdAt": "2026-09-16T11:04:33.054400Z"
  }
}
```

```json
// Test (b) Request with Tampered Token:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items
Headers: {
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tampered_signature"
}

// Actual Response (FAILED SECURITY CHECK: 201 Created instead of 401 Unauthorized):
HTTP/1.1 201 Created
{
  "message": "Item created successfully",
  "item": {
    "id": "12cc0b26-5fd1-4562-a8b4-6a9bcca12ab4",
    "status": "open"
  }
}
```

```json
// Test (c) IDOR: User C claiming User B's item:
PATCH https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items/4a0c446c-e248-4757-8c7c-ac8787688255
Headers: { "Authorization": "Bearer <User_C_Valid_Id_Token>" }
Body: { "status": "claimed" }

// Actual Response (FAILED IDOR CHECK: 200 OK without ownership check):
HTTP/1.1 200 OK
{
  "message": "Item updated",
  "item": {
    "id": "4a0c446c-e248-4757-8c7c-ac8787688255",
    "status": "claimed",
    "userId": "71a3fd5a-2051-70d0-ae24-7a366e917264",
    "updatedAt": "2026-09-16T11:04:34.314369Z"
  }
}
```

#### Root Cause:
1. `template.yaml` lines 174-178 define the Cognito authorizer under `Api.Properties.Auth.Authorizers.CognitoAuth`, but **neither `DefaultAuthorizer: CognitoAuth` nor route-level `Auth.Authorizer` is set on the Functions' Api events**.
2. `items.py` extracts user info using `get_user_from_event()` via `event.get('requestContext', {}).get('authorizer', {}).get('claims', {})`, defaulting to `'anonymous-user'` when absent and never verifying that `body_data['userId'] == claims['sub']`.
3. Frontend `AuthContext.jsx` manages mock users in memory/localStorage and does not use the AWS Cognito SDK.

---

### 3.2 Domain 2: Upload Path & Object Storage (Amazon S3)

#### Test Cases Executed:
1. **Presigned Upload URL Generation**: Called `POST /uploads/presign` with valid JPEG metadata.
2. **S3 Direct Upload via PUT**: Uploaded image bytes to the generated presigned URL.
3. **Object Metadata Verification in S3**: Verified S3 object key, size, and ContentType using `HeadObject`.
4. **Bucket Public Access Verification**: Attempted direct HTTP `GET` against the returned `photoUrl`.
5. **Edge Cases**:
   - Wrong MIME type (`application/x-msdownload` / `malware.exe`).
   - Filename with Unicode & spaces (`"my blue backpack 🎒 @ campus.png"`).
   - Zero-byte file upload.

#### Evidence:
```json
// Presign Request:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/uploads/presign
Body: {
  "filename": "camera_photo.jpg",
  "fileType": "image/jpeg",
  "itemId": "75823958-e310-433a-abbc-889e68200274"
}

// Presign Response:
HTTP/1.1 200 OK
{
  "uploadUrl": "https://campusfind-photos-694442891642-ap-south-1.s3.amazonaws.com/items/75823958-e310-433a-abbc-889e68200274/afa33044.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "photoUrl": "https://campusfind-photos-694442891642-ap-south-1.s3.ap-south-1.amazonaws.com/items/75823958-e310-433a-abbc-889e68200274/afa33044.jpg",
  "key": "items/75823958-e310-433a-abbc-889e68200274/afa33044.jpg",
  "itemId": "75823958-e310-433a-abbc-889e68200274"
}
```

```http
// Direct S3 photoUrl Access Check:
GET https://campusfind-photos-694442891642-ap-south-1.s3.ap-south-1.amazonaws.com/items/75823958-e310-433a-abbc-889e68200274/afa33044.jpg

// Response (BROKEN IMAGE URL: 403 Forbidden):
HTTP/1.1 403 Forbidden
<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Access Denied</Message>
  <RequestId>TFCBRKSY97RF2B4V</RequestId>
</Error>
```

```json
// Wrong MIME Type Check:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/uploads/presign
Body: { "filename": "trojan.exe", "fileType": "application/x-msdownload" }

// Response (PASS):
HTTP/1.1 400 Bad Request
{
  "error": "Unsupported file type 'application/x-msdownload'. Supported: JPEG, PNG, WEBP."
}
```

#### S3 Bucket Public Access Block Configuration:
```json
{
  "BlockPublicAcls": true,
  "IgnorePublicAcls": true,
  "BlockPublicPolicy": true,
  "RestrictPublicBuckets": true
}
```

#### Key Findings:
- **Image Display Failure:** S3 bucket has `BlockPublicAccess` enabled (correct for security), but `uploads.py` constructs a raw public URL (`https://{bucket}.s3.{region}.amazonaws.com/{key}`). Because the bucket is private and has no public read policy, any client attempting to render images from `item.photoUrl` receives **HTTP 403 AccessDenied**.
- Presigned GET URLs or CloudFront with Origin Access Control (OAC) are not implemented.

---

### 3.3 Domain 3: Trigger Chain (S3 → Lambda → Rekognition)

#### Test Cases Executed:
1. Created item `rek-test-8800d3` in DynamoDB table `CampusFind-Items`.
2. Uploaded image `photo.jpg` to `s3://campusfind-photos-694442891642-ap-south-1/items/rek-test-8800d3/photo.jpg`.
3. Monitored CloudWatch Log Group `/aws/lambda/campusfind-stack-RekognitionTriggerFunction-xPrt8qGuAccU`.
4. Inspected DynamoDB item after trigger to check if `ai_tags` and `detected_labels` were populated.
5. Tested AI Matching Engine with genuine match vs. unrelated item.

#### CloudWatch Log Evidence:
```text
START RequestId: f306b1cf-669a-4904-8c9e-683d867e7e05 Version: $LATEST
[INFO] Received S3 Rekognition Event: {"Records": [{"eventSource": "aws:s3", "eventName": "ObjectCreated:Put", "s3": {"bucket": {"name": "campusfind-photos-694442891642-ap-south-1"}, "object": {"key": "items/0e4b98d0-28d9-434e-bf56-4792a1c8b05d/495bd018.jpg"}}}]}
[INFO] Rekognition analysis for items/0e4b98d0-28d9-434e-bf56-4792a1c8b05d/495bd018.jpg: {'ai_tags': ['Gray', 'grey'], 'detected_labels': [{'name': 'Gray', 'confidence': 100.0}], 'parent_categories': [], 'dominant_colors': ['grey']}
[ERROR] Error updating DynamoDB item 0e4b98d0-28d9-434e-bf56-4792a1c8b05d: Float types are not supported. Use Decimal types instead.
END RequestId: f306b1cf-669a-4904-8c9e-683d867e7e05
REPORT RequestId: f306b1cf-669a-4904-8c9e-683d867e7e05 Duration: 1652.77 ms Billed Duration: 1951 ms Memory Size: 256 MB Max Memory Used: 97 MB
```

#### DynamoDB Item State After S3 Trigger:
```json
// DynamoDB GetItem on rek-test-8800d3:
{
  "id": "rek-test-8800d3",
  "title": "Lost Apple MacBook Air M2",
  "type": "lost",
  "category": "Electronics",
  "location": "Main Campus Library",
  "description": "Midnight blue color with stickers",
  "status": "open",
  "createdAt": "2026-09-16T11:04:37Z",
  "userId": "usr-test"
  // NOTE: ai_tags, detected_labels, and dominant_colors are completely MISSING!
}
```

#### Matching Engine Verification:
When comparing Lost Item `rek-test-8800d3` against Found Candidate `found-test-7def6e` (Found Apple Laptop):
```json
GET https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items/rek-test-8800d3/matches

HTTP/1.1 200 OK
{
  "target_item": { "id": "rek-test-8800d3", "title": "Lost Apple MacBook Air M2" },
  "matches": [
    {
      "item": {
        "id": "found-test-7def6e",
        "title": "Found Apple Laptop Midnight",
        "category": "Electronics",
        "location": "Main Library Circulation",
        "type": "found"
      },
      "score": 53.2,
      "breakdown": {
        "category": 100.0,
        "visual": 0.0,
        "location": 85.0,
        "text": 41.7
      },
      "reasons": [
        "Exact category match: Electronics",
        "Same campus area: Library",
        "Title keywords match: [apple]"
      ]
    }
  ],
  "match_count": 1
}
```

#### Key Findings:
- **Silent Failure in S3 Trigger:** `rekognition_processor.py` line 87 rounds label confidence using Python `round(label['Confidence'], 1)`, producing a `float`. Boto3 DynamoDB Table resource **strictly rejects Python floats**, throwing `TypeError: Float types are not supported. Use Decimal types instead`.
- Because line 217 catches `Exception`, the failure is logged as an error but swallowed. Lambda exits with `200 OK`, and **Rekognition tags are never saved to DynamoDB**.
- **Visual Matching Breakdown:** Notice the visual score in match breakdown is `0.0` because the S3 trigger failed to persist visual tags to DynamoDB.

---

### 3.4 Domain 4: Persistence Layer (Amazon DynamoDB)

#### Table Architecture Analysis:
1. **`CampusFind-Items` Schema**:
   - Primary Key: `id` (String, HASH)
   - Global Secondary Index: `TypeCreatedAtIndex` (HASH: `type`, RANGE: `createdAt`, Projection: ALL)
   - Billing Mode: `PAY_PER_REQUEST` (On-Demand)
2. **`CampusFind-Alerts` Schema**:
   - Primary Key: `id` (String, HASH)
   - Billing Mode: `PAY_PER_REQUEST` (On-Demand)

#### Query vs. Scan Anti-Pattern:
- In `backend/lambda/items.py`:
  - `handle_list_items()` (lines 83-90): Performs `table.scan(**scan_kwargs)`. **It never calls `table.query()` against `TypeCreatedAtIndex`**, even when filtering by `type='lost'` or `type='found'`.
  - `handle_get_matches()` (lines 193-196): Performs `table.scan(FilterExpression=Attr('type').eq(opposing_type) & ...)`.
- In `backend/lambda/alerts.py`:
  - `handle_list_alerts()` (line 164): Performs `table.scan()`.
- **Impact:** As the lost and found database grows, every feed refresh and match computation scans the entire DynamoDB dataset, leading to linear latency increases and unbounded read request unit consumption.

#### CRUD Lifecycle Test:
1. **Create Item:** `POST /items` -> Stored row in `CampusFind-Items`. (PASS)
2. **Read Item:** `GET /items/{id}` -> Retrieved row. (PASS)
3. **Update Status:** `PATCH /items/{id}` with `{'status': 'claimed'}` -> Updated attribute in table. (PASS)
4. **Delete Item:** `DELETE /items/{id}` -> **FAILED (HTTP 403 Forbidden)**. Route does not exist in API Gateway or Lambda router.

---

### 3.5 Domain 5: Notifications (Amazon SNS)

#### Test Cases Executed:
1. **Student Subscription:** `POST /alerts/subscribe` with email `student_alert_db289b@testcampus.edu`.
2. **Emergency Broadcast:** `POST /alerts` with critical severity payload.
3. **SNS Publishing & DynamoDB Persistence Verification**.

#### Evidence:
```json
// Subscription Request:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/alerts/subscribe
Body: { "endpoint": "student_alert_db289b@testcampus.edu", "protocol": "email" }

// Response:
HTTP/1.1 200 OK
{
  "message": "Subscription request submitted. Check student_alert_db289b@testcampus.edu to confirm.",
  "subscriptionArn": "pending confirmation"
}
```

```json
// Emergency Alert Broadcast Request:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/alerts
Headers: { "Authorization": "Bearer admin-token" }
Body: {
  "title": "Severe Weather Flash Flood Warning",
  "message": "Campus basement classrooms are advised to relocate to 2nd floor.",
  "severity": "critical",
  "zone": "Lower Campus",
  "channels": ["sms", "email", "in_app"],
  "senderName": "Campus Police Dispatch",
  "isAdmin": true
}

// Response:
HTTP/1.1 201 Created
{
  "message": "Emergency alert broadcasted successfully",
  "alert": {
    "id": "2c0e7621-5d60-4f0a-886c-04246bcb7262",
    "title": "Severe Weather Flash Flood Warning",
    "message": "Campus basement classrooms are advised to relocate to 2nd floor.",
    "severity": "critical",
    "zone": "Lower Campus",
    "channels": ["sms", "email", "in_app"],
    "active": true,
    "senderName": "Campus Police Dispatch",
    "senderEmail": "security@campus.edu",
    "createdAt": "2026-09-16T11:04:44.736586Z",
    "snsMessageId": "56ac2107-e5b9-5d25-80ef-42239fb5d27a",
    "broadcastStatus": "delivered"
  }
}
```

```json
// DynamoDB Stored Record in CampusFind-Alerts:
{
  "id": "2c0e7621-5d60-4f0a-886c-04246bcb7262",
  "active": true,
  "broadcastStatus": "delivered",
  "channels": ["sms", "email", "in_app"],
  "createdAt": "2026-09-16T11:04:44.736586Z",
  "message": "Campus basement classrooms are advised to relocate to 2nd floor.",
  "senderEmail": "security@campus.edu",
  "senderName": "Campus Police Dispatch",
  "severity": "critical",
  "snsMessageId": "56ac2107-e5b9-5d25-80ef-42239fb5d27a",
  "title": "Severe Weather Flash Flood Warning",
  "zone": "Lower Campus"
}
```

#### Key Findings:
- SNS broadcast and DynamoDB alert logging execute successfully.
- **Admin Authorization Flaw:** In `backend/lambda/alerts.py` line 63, `if 'admin-token' in auth_header or body_data.get('isAdmin') is True:` allows any unauthenticated caller to bypass admin access control simply by setting `"isAdmin": true` in the JSON body.
- **No Idempotency Token:** If the client double-clicks or Lambda retries, duplicate SNS messages will be published to all subscribers.

---

### 3.6 Domain 6: API Gateway Robustness & Input Validation

#### Test Cases Executed:
1. **CORS Preflight:** Sent `OPTIONS /items` with preflight headers. (PASS: Returns 200 with `Access-Control-Allow-Origin: *`).
2. **Malformed JSON:** Sent truncated JSON `{'title': 'broken json, missing quote}`.
3. **Missing Required Fields:** Sent `POST /items` without `type`, `category`, or `location`.
4. **Injection Payloads:** Sent SQL injection, NoSQL operator injection, and XSS strings in text fields.
5. **Oversized Payload:** Sent 7MB JSON body.

#### Evidence:
```http
// Malformed JSON Test:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items
Headers: { "Content-Type": "application/json" }
Body: {'title': 'broken json, missing quote}

// Actual Response (UNHANDLED CRASH: 502 Bad Gateway):
HTTP/1.1 502 Bad Gateway
{
  "message": "Internal server error"
}
```

```json
// Missing Required Fields Test:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items
Body: { "title": "Incomplete Item" }

// Actual Response (HANDLED: 400 Bad Request):
HTTP/1.1 400 Bad Request
{
  "error": "Missing required field: 'type'"
}
```

```json
// Injection Payload Test:
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items
Body: {
  "title": "'; DROP TABLE Items; --",
  "type": "lost",
  "category": "Electronics",
  "location": "{\"id\": {\"$gt\": \"\"}}",
  "description": "<script>alert('XSS')</script> ' OR '1'='1"
}

// Actual Response (STORED RAW UNSANITIZED):
HTTP/1.1 201 Created
{
  "message": "Item created successfully",
  "item": {
    "id": "76ec283a-4467-4eb7-a4ad-0245cb570198",
    "title": "'; DROP TABLE Items; --",
    "description": "<script>alert('XSS')</script> ' OR '1'='1",
    "status": "open"
  }
}
```

```http
// Oversized Payload (> 6MB limit):
POST https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod/items
Body: <7MB payload>

// Actual Response (API Gateway Enforcement):
HTTP/1.1 413 Payload Too Large
```

#### Key Findings:
- `items.py` does `body_data = json.loads(event.get('body') or '{}')` directly inside `lambda_handler` without catching `json.JSONDecodeError`. Malformed client requests cause the Lambda process to crash, returning `502 Bad Gateway`.
- Injection strings are stored as-is in DynamoDB. While DynamoDB is not vulnerable to SQL injection, stored XSS strings in `description` or `title` present a front-end script injection risk if rendered unsanitized.

---

### 3.7 Domain 7: IAM and Cost Hygiene

#### 1. CloudWatch Log Group Retentions:
| Log Group | Configured Retention | Risk Assessment |
| :--- | :--- | :--- |
| `/aws/lambda/campusfind-stack-ItemsFunction-...` | **Never Expire** (Infinite) | **Cost Leak**: Log data accumulates indefinitely, incurring continuous CloudWatch storage charges. |
| `/aws/lambda/campusfind-stack-AlertsFunction-...` | **Never Expire** (Infinite) | **Cost Leak**: Log data accumulates indefinitely. |
| `/aws/lambda/campusfind-stack-RekognitionTriggerFunction-...` | **Never Expire** (Infinite) | **Cost Leak**: Log data accumulates indefinitely. |
| `/aws/lambda/campusfind-stack-UploadPresignFunction-...` | **Never Expire** (Infinite) | **Cost Leak**: Log data accumulates indefinitely. |

#### 2. S3 Storage Lifecycle:
- `PhotosBucket` has **no S3 Lifecycle Configuration (`NoSuchLifecycleConfiguration`)**.
- Every uploaded lost/found image remains permanently in S3 Standard storage tier with no automatic transition to Infrequent Access / Glacier or expiration after item resolution.

#### 3. Lambda Configuration Limits:
- Memory: `256 MB`
- Timeout: `30 seconds`
- Runtimes: `python3.12`
- Tracing: `Active` (AWS X-Ray enabled)

#### 4. IAM Role Permissions Review:
- **`ItemsFunctionRole`**: Scoped to `CampusFind-Items` and indexes. Includes `AWSXrayWriteOnlyAccess` and `AWSLambdaBasicExecutionRole`. (Appropriate)
- **`AlertsFunctionRole`**: Scoped to `CampusFind-Alerts` and `CampusFind-EmergencyAlerts` SNS topic. (Appropriate)
- **`UploadPresignFunctionRole`**: Contains `s3:PutLifecycleConfiguration` in policy statement, which is excessive for generating presigned upload URLs.
- **`RekognitionTriggerFunctionRole`**: Contains `sns:Publish` to `CampusFind-EmergencyAlerts`, but `rekognition_processor.py` never publishes to SNS. Contains `rekognition:Detect*` on `*` (standard for Rekognition detection).

---

## 4. Prioritized Bug Register

### 🔴 CRITICAL (Security Vulnerabilities & Data Loss / Silent Failures)

| ID | Title | Component | Impact | Root Cause & Reproduction |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **API Gateway Routes Open Without Authentication (`authorizationType: NONE`)** | `template.yaml` / API Gateway | Any unauthenticated internet user can create, read, and mutate lost/found items and broadcast alerts. | `template.yaml` defines `CognitoAuth` but never attaches `DefaultAuthorizer` or `Auth.Authorizer` to the route definitions. Calling `POST /items` with no `Authorization` header succeeds with `201 Created`. |
| **BUG-02** | **Rekognition Labels Silently Dropped by DynamoDB Float TypeError** | `rekognition_processor.py` (L87, L207) | S3 image upload invokes Rekognition, but AI labels are **never stored in DynamoDB**. Item records lack AI tags, breaking visual matching. | Python `float` confidence scores from Rekognition are passed to DynamoDB Boto3 resource, throwing `Float types are not supported. Use Decimal types instead`. Exception is caught and swallowed at L217. |
| **BUG-03** | **Uploaded S3 Photos Inaccessible (403 Forbidden) Due to Public Access Block** | `uploads.py` (L80) / S3 | All item photos uploaded to S3 fail to render on the web frontend with HTTP 403. | `uploads.py` generates raw public S3 URLs (`https://{bucket}.s3.amazonaws.com/...`), but S3 Public Access Block is enabled and no presigned GET or CloudFront OAC is provided. |
| **BUG-04** | **Insecure Direct Object Reference (IDOR) on Item Modification** | `items.py` (L163-L182) | Any user can change the status of another user's lost/found report (e.g. mark it "claimed" or "resolved"). | `handle_update_item` performs `table.update_item` without verifying that the caller's `sub`/`userId` matches the item's stored `userId`. |
| **BUG-05** | **Emergency Alert Admin Access Bypass via `isAdmin: true`** | `alerts.py` (L63) | Any user can broadcast campus-wide emergency alerts to all SNS subscribers. | `is_admin_or_security()` explicitly checks `if body_data.get('isAdmin') is True:` and allows the request through. |

---

### 🟠 MAJOR (Broken Features & Performance Bottlenecks)

| ID | Title | Component | Impact | Root Cause & Reproduction |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-06** | **Frontend Cognito Integration Missing (Mock Auth Only)** | `frontend/src/context/AuthContext.jsx` | Frontend authentication does not talk to Amazon Cognito; authenticates against a static array and stores mock users in `localStorage`. | `AuthContext.jsx` has no AWS Amplify / Amazon Cognito SDK integration. Login merely updates React state. |
| **BUG-07** | **Full Table Scans on Every Item & Alert List / Search Request** | `items.py` (L89, L193), `alerts.py` (L164) | DynamoDB scans entire table on every feed load or match search, ignoring GSI `TypeCreatedAtIndex`. Unscalable and expensive. | Handlers call `table.scan()` with filter expressions rather than `table.query()` against the GSI partition key. |
| **BUG-08** | **Unhandled `JSONDecodeError` Causes 502 Bad Gateway** | `items.py` (L234, L241), `alerts.py` (L214, L221) | Sending malformed JSON returns API Gateway 502 Bad Gateway instead of standard 400 Bad Request. | `json.loads(event.get('body'))` is called without `try...except json.JSONDecodeError`. |
| **BUG-09** | **`DELETE /items/{id}` Route Not Implemented** | `template.yaml`, `items.py` | Users cannot delete reports; calling HTTP DELETE returns 403 Forbidden from API Gateway. | No API Gateway event or Lambda routing logic exists for HTTP DELETE. |
| **BUG-10** | **Local Server Endpoints Missing from AWS API Gateway** | `local_server.py` vs. `template.yaml` | `GET /api/auth/demo-users`, `POST /api/rekognition/analyze`, and `POST /api/uploads/photo` only exist locally; breaking features when pointing to AWS. | Endpoints were only written in FastAPI `local_server.py` and never ported to Lambda / SAM. |

---

### 🟡 MINOR (Cosmetic, Hygiene & Cost Risks)

| ID | Title | Component | Impact | Root Cause & Reproduction |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-11** | **Infinite CloudWatch Log Retention & Missing S3 Lifecycle Rules** | `template.yaml` / AWS Config | Accumulates continuous storage costs in AWS free-tier account. | SAM template does not specify `RetentionInDays` on Lambda log groups or `LifecycleConfiguration` on `PhotosBucket`. |
| **BUG-12** | **Fallback Simulation Masks Rekognition Errors with Fake Backpack Tags** | `rekognition_processor.py` (L148-L176) | If Rekognition throws or fails, the handler fabricates tags `['Backpack', 'Bag', 'Luggage']`, corrupting item data. | `analyze_image_with_rekognition()` catches all exceptions and invokes `fallback_image_analysis()`. |
| **BUG-13** | **Hardcoded Region `us-east-1` in Lambda Handler Fallbacks** | `items.py`, `alerts.py`, `uploads.py`, `rekognition_processor.py` | If `AWS_REGION` env variable is missing, handlers attempt to connect to `us-east-1` instead of `ap-south-1`. | `os.environ.get('AWS_REGION', 'us-east-1')` is used instead of inheriting dynamic Lambda runtime region. |
| **BUG-14** | **Excessive IAM Permissions on Lambda Roles** | `template.yaml` (L236, L294) | Violates least privilege principle. | `UploadPresignFunctionRole` has `s3:PutLifecycleConfiguration`, and `RekognitionTriggerFunctionRole` has `sns:Publish` without using them. |
| **BUG-15** | **No Idempotency Protection on Emergency Alerts Broadcast** | `alerts.py` (L68-L112) | Network retries or rapid clicks send duplicate SMS/email alerts to all subscribers. | No DynamoDB conditional check or SNS deduplication ID is implemented. |

---

## 5. Verification Verdict & Next Steps

### Verdict:
While the individual AWS services (Cognito, S3, DynamoDB, SNS, Rekognition) are provisioned and operational in `ap-south-1`, **the integration layer suffers from critical security misconfigurations and a silent data serialization failure**:
1. The API Gateway is **completely unauthenticated** because the Cognito Authorizer is declared but not attached to routes.
2. The core AI feature (Rekognition visual tag extraction) **fails silently on every single upload** due to a Python float-to-DynamoDB serialization error.
3. Photos stored in S3 **cannot be viewed** because the app returns raw S3 URLs against a private bucket.

As instructed, **no code or configuration changes have been applied**. This report serves as the complete diagnostic assessment. Awaiting user review and authorization before proceeding with fixes.
