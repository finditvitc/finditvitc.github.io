# CampusFind — Campus Lost & Found and Emergency Alert System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-finditvitc.github.io-brightgreen?style=for-the-badge&logo=github)](https://finditvitc.github.io/)

**CampusFind** is a cloud-native, full-stack web application designed for university campuses. Built from scratch with an event-driven serverless architecture on **Amazon Web Services (AWS)**, it combines an intelligent computer-vision matching engine powered by **Amazon Rekognition** with a high-priority emergency broadcast system powered by **Amazon SNS**, secured by **Amazon Cognito**.

🌐 **Live URL:** [https://finditvitc.github.io/](https://finditvitc.github.io/)

---

## System Architecture

```mermaid
graph TB
    subgraph Client ["Frontend (React SPA)"]
        UI["React SPA (Vite + Tailwind CSS)"]
        FeedUI["Search & Filter Feed"]
        ReportUI["Lost/Found Reporter"]
        MatchUI["AI Match Breakdown"]
        AlertUI["Admin Emergency Panel"]
    end

    subgraph Security ["Auth & Access"]
        Cognito["Amazon Cognito User Pool"]
        StudentGroup["Students Group"]
        AdminGroup["Admin/Security Group"]
    end

    subgraph Gateway ["API Layer"]
        APIGW["Amazon API Gateway (REST API)"]
        Authorizer["Cognito JWT Authorizer"]
    end

    subgraph Compute ["Serverless Backend (AWS Lambda)"]
        ItemsFn["Items Lambda<br/>(CRUD & Search)"]
        UploadFn["Upload Presign Lambda"]
        MatchFn["AI Match Engine Lambda"]
        AlertsFn["Emergency Alerts Lambda"]
        RekogTriggerFn["S3 Rekognition Lambda<br/>(Auto-Tagger)"]
    end

    subgraph AI ["Vision AI"]
        Rekognition["Amazon Rekognition<br/>(DetectLabels & Colors)"]
    end

    subgraph Storage ["Storage & Database"]
        S3Bucket["Amazon S3 Bucket<br/>(Item Photos)"]
        DDBItems["DynamoDB: CampusFind-Items"]
        DDBAlerts["DynamoDB: CampusFind-Alerts"]
    end

    subgraph Notification ["Push & Broadcast"]
        SNSTopic["Amazon SNS Topic<br/>(Campus-Emergency-Alerts)"]
        SES["Amazon SES<br/>(Email Dispatch)"]
        InApp["In-App Emergency Banner"]
    end

    %% Flows
    UI -->|Sign In / Get JWT| Cognito
    Cognito -.-> StudentGroup
    Cognito -.-> AdminGroup
    UI -->|API Requests with Bearer Token| APIGW
    APIGW --> Authorizer
    Authorizer --> Cognito

    APIGW -->|/items| ItemsFn
    APIGW -->|/uploads/presign| UploadFn
    APIGW -->|"/items/{id}/matches"| MatchFn
    APIGW -->|/alerts (Admin only)| AlertsFn

    UploadFn -->|Presigned URL| S3Bucket
    UI -->|Direct Upload Photo| S3Bucket
    S3Bucket -->|s3:ObjectCreated Trigger| RekogTriggerFn
    RekogTriggerFn --> Rekognition
    RekogTriggerFn -->|Save AI tags & triggers match| DDBItems

    ItemsFn --> DDBItems
    MatchFn --> DDBItems
    AlertsFn --> DDBAlerts
    AlertsFn -->|Publish broadcast| SNSTopic
    SNSTopic --> SES
    DDBAlerts -.->|Active alert sync| InApp
```

---

## AWS Services Mapping

| Required Service | Implementation Details |
| :--- | :--- |
| **Amazon S3** | Stores uploaded item photos. Emits `s3:ObjectCreated:*` events to trigger the Rekognition Lambda auto-tagger. S3 presigned PUT URLs allow direct, secure frontend photo uploads. |
| **Amazon Rekognition** | Analyzes item photos using `DetectLabels` to extract object labels (e.g. *Backpack*, *Laptop*, *Headphones*), dominant colors, and categories with confidence scores. |
| **AWS Lambda** | 4 Python serverless functions: `items.py` (CRUD & queries), `rekognition_processor.py` (vision auto-tagger), `matching_engine.py` (AI similarity calculator), `alerts.py` (SNS broadcaster), and `uploads.py` (S3 presigner). |
| **Amazon DynamoDB** | `CampusFind-Items` table (with GSI `TypeCreatedAtIndex` for sub-second feed lookups) and `CampusFind-Alerts` table with On-Demand billing mode. |
| **Amazon SNS** | `CampusFind-EmergencyAlerts` topic broadcasting urgent alerts to subscribed student endpoints via SMS and Email, plus notification fan-out. |
| **Amazon API Gateway** | REST API exposing CORS-enabled endpoints (`/items`, `/items/{id}`, `/items/{id}/matches`, `/alerts`, `/uploads/presign`). Protected with Cognito JWT Authorizer. |
| **Amazon Cognito** | `CampusFind-Students-Pool` User Pool for student sign-up/login with campus emails, featuring dedicated `Admin` and `Student` User Pool Groups to enforce emergency broadcast permissions. |

---

## AI Matching Algorithm

The matching engine computes a multi-factor similarity score between lost and found items:

$$\text{Match Score} = (S_{\text{category}} \times 30\%) + (S_{\text{Rekognition}} \times 35\%) + (S_{\text{location}} \times 20\%) + (S_{\text{keywords}} \times 15\%)$$

1. **Category Match (30%)**: Exact match (100%) or hierarchical/related category match (70%).
2. **Amazon Rekognition Visual Tags (35%)**: Computes weighted Jaccard & intersection ratio between auto-detected vision labels and dominant colors.
3. **Campus Location Zone (20%)**: Maps campus locations to zones (Library, Student Center, Science Quad, Gym, Dining Commons, Dorms).
4. **Keywords & Description (15%)**: Normalized token overlap across title and descriptive text.

---

## Quick Start (Run Locally)

You can run the full application (both frontend and backend API) locally in one step:

### Option 1: Double-Click or Terminal

```bash
# Windows Batch
start.bat

# Or PowerShell
.\start.ps1

# Or Python directly
python backend/local_server.py
```

Open **`http://localhost:8000`** in your browser.

### Option 2: Live Hot-Reload Frontend Development

```bash
# Terminal 1: Backend Server
python backend/local_server.py

# Terminal 2: React Vite Dev Server
cd frontend
npm run dev
```

Open **`http://localhost:5173`**.

---

## Testing Core Features

### 1. Lost & Found Feed & Search
- Navigate to **"Item Feed"**.
- Filter by **"Lost Items"** or **"Found Items"**.
- Filter by category pills (e.g. *Electronics*, *Bags & Backpacks*, *Keys*).
- Type in the search box (e.g. `"laptop"`, `"backpack"`, `"library"`).
- Click on any item to view its details, photo, and Amazon Rekognition tags.

### 2. Auto-Tagging & Photo Upload (Amazon Rekognition)
- Click **"Report Lost"** or **"Report Found"**.
- Enter title, category, and location.
- Upload an item photo.
- Notice the **AWS Rekognition Auto-Tagging** in action: the system detects labels (e.g. `Laptop 98%`, `Electronics 95%`, `Keyboard 91%`).
- Submit the report — it will be saved to DynamoDB and immediately checked for matches.

### 3. AI Match Suggestions
- Navigate to **"My Reports"**.
- Select any of your reports on the left.
- View the **"AI-Suggested Opposing Matches"** panel on the right.
- Inspect the **AI Match Confidence** (e.g. `79.5% High Match`), visual criteria breakdown pills, and the specific match rationale (*"Category matched: Electronics"*, *"Matching visual tags: [computer, electronics, laptop]"*, *"Same campus area: Library"*).
- Click **"Contact / Claim"** to ping the owner/finder.

### 4. Emergency Alerts (Amazon SNS)
- Switch your active user profile to **"Officer J. Martinez (admin)"** via the top right profile dropdown.
- Click on **"Emergency Console"** (Admin-only).
- Select Severity (e.g. *Critical Emergency* or *Safety Warning*), affected campus zone, and broadcast channels (*SMS*, *Campus Email*, *In-App Banner*).
- Click **"BROADCAST CAMPUS EMERGENCY ALERT NOW"**.
- Notice the emergency banner update across the top of all screens with urgent action instructions and Amazon SNS dispatch confirmation.

---

## Deploying to AWS Cloud (IaC with AWS SAM)

The `infrastructure/` directory includes a production-ready AWS SAM template (`template.yaml`) provisioning Cognito, S3, DynamoDB, SNS, API Gateway, and Lambda functions.

### One-Click Deploy:

```bash
cd infrastructure

# On Windows
.\deploy.ps1 -Region us-east-1

# On Linux/macOS
./deploy.sh
```

Or run SAM directly:
```bash
sam build
sam deploy --guided
```

After deployment, copy the generated stack outputs into `frontend/.env`:
```env
VITE_AWS_MODE=true
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=<user-pool-id>
VITE_COGNITO_CLIENT_ID=<client-id>
VITE_S3_BUCKET_NAME=<photos-bucket-name>
VITE_AWS_REGION=us-east-1
```

---

## Directory Structure

```
├── backend/
│   ├── lambda/
│   │   ├── items.py                 # REST API Lambda for items CRUD & search
│   │   ├── rekognition_processor.py # S3 trigger Lambda invoking Rekognition
│   │   ├── matching_engine.py      # Multi-factor AI matching algorithm
│   │   ├── alerts.py               # Emergency broadcast Lambda via Amazon SNS
│   │   └── uploads.py              # S3 presigned URL generator
│   ├── tests/
│   │   └── test_matching.py        # Pytest suite for AI matching engine
│   ├── local_server.py             # FastAPI dev server simulating AWS services
│   └── uploads/                    # Local photo upload storage
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Top navigation & user profile switcher
│   │   │   ├── EmergencyBanner.jsx # Real-time emergency broadcast banner
│   │   │   ├── ItemDetailsModal.jsx# Full report viewer with Rekognition tags
│   │   │   ├── AWSArchitectureModal.jsx # Cloud architecture visualization
│   │   │   └── AuthModal.jsx       # Student & Admin authentication
│   │   ├── pages/
│   │   │   ├── FeedPage.jsx        # Searchable, filterable campus feed
│   │   │   ├── ReportItemPage.jsx  # Lost & Found report creator with vision AI
│   │   │   ├── MyReportsPage.jsx   # Personal reports & AI Match Finder
│   │   │   └── AdminAlertPanel.jsx # Emergency broadcast console
│   │   ├── services/
│   │   │   └── api.js              # Unified client for local API & AWS Gateway
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Cognito authentication context
│   │   ├── App.jsx                 # Main application shell
│   │   └── index.css               # Tailwind CSS & custom styles
│   ├── package.json
│   └── tailwind.config.js
│
├── infrastructure/
│   ├── template.yaml               # AWS SAM / CloudFormation template
│   ├── deploy.ps1                  # PowerShell deploy script
│   ├── deploy.sh                   # Bash deploy script
│   └── README.md                   # AWS deployment documentation
│
├── start.bat                       # 1-click Windows starter
├── start.ps1                       # 1-click PowerShell starter
└── README.md                       # Main project documentation
```
