# FindIt VITC — System Architecture & Project Knowledge

## Project Identity & Context
- **Application**: FindIt VITC — VIT Chennai Lost & Found + Safety Grid.
- **Target Audience**: Exclusively for VIT Chennai campus students, faculty, and security personnel.
- **Timezone**: Indian Standard Time (IST, UTC+5:30).

---

## AWS Architecture & Resources
- **Region**: `ap-south-1` (Mumbai) | **AWS Account ID**: `694442891642`
- **Cost Policy**: 100% AWS Free Tier eligible (\$0 idle cost; no NAT Gateways or paid provisioning).
- **API Gateway (REST)**: `https://8d3aayrch4.execute-api.ap-south-1.amazonaws.com/prod`
  - Open application-level auth with custom CORS GatewayResponses (`DEFAULT_4XX`, `DEFAULT_5XX`).
- **Cognito User Pool**: `ap-south-1_K5c6MntVx` | **Client ID**: `5068gn9iktlj9670vdntdn125m`
  - Pre Sign-up Lambda Trigger: `campusfind-cognito-presignup-trigger` (`backend/lambda/pre_signup.py`).
- **DynamoDB Tables**:
  - `CampusFind-Items` (Primary: `id`, GSI: `TypeCreatedAtIndex` on `type` + `createdAt`).
  - `CampusFind-Alerts` (Primary: `id`, GSI: `CreatedAtIndex`).
- **S3 Bucket**: `campusfind-photos-694442891642-ap-south-1` (Private, Block Public Access enabled).
- **SNS Topic**: `arn:aws:sns:ap-south-1:694442891642:CampusFind-EmergencyAlerts`
- **Deployed Lambda Functions**:
  - `campusfind-stack-ItemsFunction-EyCvEzxJrwwg`
  - `campusfind-stack-AlertsFunction-ZdPNcRr770ZS`
  - `campusfind-stack-UploadPresignFunction-SQLqaaJ1Nx1f`
  - `campusfind-stack-RekognitionTriggerFunction-xPrt8qGuAccU`
  - `campusfind-cognito-presignup-trigger`

---

## Authentication & Security Rules
- **Domain Restriction**: User self-registration strictly restricted to `@vitstudent.ac.in` (validated on client and enforced server-side via Pre Sign-up Lambda).
- **Role Privileges**:
  - `Student`: Default role for all self-registered `@vitstudent.ac.in` users.
  - `Admin` / `Security`: Provisioned exclusively via Cognito User Pool groups (`Admin`, `Security`). No UI self-registration allowed.
- **Session Management**:
  - Tokens and authenticated user object stored in `sessionStorage` (`findit_session_user`).
  - Unauthenticated visits or fresh tabs always land on the Login/Landing portal (`currentUser === null`).
  - Legacy `localStorage` auth keys (`campusfind_user`, `findit_user`, demo users) permanently purged.
- **Ownership & Authorization**:
  - Item claim/status updates require authenticated user to match item `userId`/`userEmail` (or hold `Admin` role).
  - Emergency SNS alert broadcasting strictly gated to verified `Admin` / `Security` group members.

---

## Campus Domain Standards
- **22 Approved Campus Locations**:
  `AB1`, `AB2`, `AB3`, `AB4`, `AB5`, `LIBRARY`, `ADMIN BLOCK`, `MG AUDITORIUM`, `NETAJI AUDITORIUM`, `KASTURBA AUDITORIUM`, `VOC AUDITORIUM`, `CRICKET GROUND`, `FOOTBALL GROUND`, `GAZEBO`, `NORTH SQUARE`, `LASSI HOUSE`, `SWIMMING POOL`, `VOLLEYBALL COURT`, `BASKETBALL COURT`, `GYMNASIUM`, `GYMKHANA`, `VMART`.
- **11 Approved Schools (Department Attribute `custom:department`)**:
  `SCOPE`, `SENSE`, `SELECT`, `SMEC`, `SCE`, `SBST`, `VITBS`, `VITSOL`, `SSL`, `VSMART`, `VFIT`.

---

## AI Vision & Match Engine
- **Rekognition Processing**:
  - Confidence values stored in DynamoDB wrapped as `Decimal(str(round(conf, 1)))` (prevents Python `float` serialization crash).
  - Multi-stage adaptive confidence query (45% -> 30%) with image property extraction.
- **Saturation-Weighted Color Clustering**:
  - Evaluates HSV space with chromatic multiplier: `score = s * (1.2 + v) * 2.0`.
  - Suppresses neutral shadows (`s < 0.18`) so vivid product colors (`Teal`, `Cyan`, `Green`, `Blue`, `Red`, `Pink`, `Purple`) take precedence.
  - Evaluated on both client canvas (0ms preview) and Lambda backend.
- **AI Matching Scoring Formula (4-Factor Weighted)**:
  - Category Match: 30%
  - Rekognition Visual Tags (Jaccard similarity): 35%
  - Location Zone Match: 20%
  - Keyword / Title Overlap: 15%
  - High Confidence Threshold: `>= 75%`.

---

## Frontend Architecture & UI/UX
- **Stack**: Vite + React 18 + Tailwind CSS v3 + Lucide React.
- **Theme**: Dark/Light mode controlled by `ThemeContext.jsx` (`html.dark` class), persisted in `localStorage.getItem('findit_theme')`.
- **Responsive Layout**:
  - Navbar desktop links use `lg:flex` and mobile drawer uses `lg:hidden` (avoids 768px tablet horizontal scroll).
  - Global `overflow-x: hidden` enforced on `html, body, #root`.
- **Image Handling**:
  - Client compresses images to ~25KB JPEG data URL via canvas before upload.
  - Fallback placeholder mapping provided for all 9 item categories (`imageFallbacks.js`).

---

## Deployment & Build Workflow
- **Live Deployment**: Hosted on GitHub Pages (`https://finditvitc.github.io`).
- **Build Sequence**:
  1. Frontend build: `cd frontend; npm run build` (or `npm run build` in `frontend/`).
  2. Sync distribution: Copy `frontend/dist/*` to project root and `docs/`.
  3. Single Page App routing: Copy `dist/index.html` to `404.html`.
  4. Lambda updates: Run `python deploy_lambdas.py` to zip `backend/lambda/` and update all 4 Lambda functions in `ap-south-1`.
  5. Git push: Deploy to `main` branch.

---

## Ruled Out / Anti-Patterns (Do Not Implement)
- **Do NOT re-add mock/demo accounts** (`DEFAULT_DEMO_USERS`, `alex.student@campus.edu`, 1-click autofill cards).
- **Do NOT use `localStorage` for session auth tokens** (causes stale auto-login bypasses).
- **Do NOT allow non-`@vitstudent.ac.in` email registration**.
- **Do NOT upgrade to Tailwind CSS v4** (stick to v3 for ecosystem compatibility).
- **Do NOT pass raw Python `float` types to Boto3 DynamoDB calls** (must use `Decimal`).
- **Do NOT define `AWS_REGION` as a custom Lambda env var** in CloudFormation templates.
- **Do NOT use `&&` in Windows PowerShell commands** (always use `;`).
