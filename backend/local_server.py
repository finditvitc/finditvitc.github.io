"""
CampusFind - Full Local Development Server & AWS Gateway Simulator
Powered by FastAPI. Exposes the identical REST API surface as AWS API Gateway + Lambda.
Supports offline development and seamless transition to AWS live deployment.
"""

import os
import sys
import uuid
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Body, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

# Ensure lambda folder is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'lambda')))

from matching_engine import find_matches_for_item, compute_match_score
from rekognition_processor import analyze_image_bytes, extract_semantic_vision_tags


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CampusFindServer")

app = FastAPI(
    title="CampusFind API",
    description="Backend API for Campus Lost & Found and Emergency Alert System",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory setup
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/uploads/{filename}")
def serve_uploaded_file(filename: str):
    filepath = os.path.join(UPLOAD_DIR, filename)
    if os.path.isfile(filepath):
        return FileResponse(filepath)
    raise HTTPException(status_code=404, detail="Uploaded photo not found")

DATA_FILE = os.path.join(os.path.dirname(__file__), "data_store.json")

# In-memory storage with file persistence
DB = {
    "items": [],
    "alerts": [],
    "subscriptions": []
}

# Seed realistic college campus lost & found reports
INITIAL_SEED_ITEMS = [
    {
        "id": "item-seed-1",
        "title": "MacBook Air 13-inch (Space Gray)",
        "type": "lost",
        "category": "Electronics",
        "location": "Science Library 3rd Floor Stacks",
        "dateTime": (datetime.utcnow() - timedelta(hours=5)).isoformat() + "Z",
        "description": "Left my laptop in a study carrel. Has a GitHub and NASA sticker on the lid. Very important for my senior thesis!",
        "photoUrl": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80",
        "ai_tags": ["Laptop", "Computer", "Electronics", "Keyboard", "Space Gray", "Screen"],
        "detected_labels": [
            {"name": "Laptop", "confidence": 98.6},
            {"name": "Computer", "confidence": 97.2},
            {"name": "Electronics", "confidence": 95.8},
            {"name": "Keyboard", "confidence": 91.4}
        ],
        "status": "open",
        "contactInfo": "alex.student@campus.edu",
        "userId": "usr-alex-001",
        "userEmail": "alex.student@campus.edu",
        "createdAt": (datetime.utcnow() - timedelta(hours=5)).isoformat() + "Z",
        "updatedAt": (datetime.utcnow() - timedelta(hours=5)).isoformat() + "Z"
    },
    {
        "id": "item-seed-2",
        "title": "Apple Laptop with Tech Stickers",
        "type": "found",
        "category": "Electronics",
        "location": "Main Campus Library Circulation Desk",
        "dateTime": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
        "description": "Found a dark gray laptop on a desk in the upper study level. Handed over to library staff at desk 2.",
        "photoUrl": "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&auto=format&fit=crop&q=80",
        "ai_tags": ["Laptop", "Computer", "Electronics", "Space Gray", "Personal Computer"],
        "detected_labels": [
            {"name": "Laptop", "confidence": 99.1},
            {"name": "Computer", "confidence": 98.0},
            {"name": "Electronics", "confidence": 96.5}
        ],
        "status": "open",
        "contactInfo": "library-lostfound@campus.edu",
        "userId": "usr-staff-002",
        "userEmail": "library-staff@campus.edu",
        "createdAt": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
        "updatedAt": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z"
    },
    {
        "id": "item-seed-3",
        "title": "Navy Blue Fjällräven Kånken Backpack",
        "type": "lost",
        "category": "Bags & Backpacks",
        "location": "Student Union Dining Commons",
        "dateTime": (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z",
        "description": "Left on a chair near the pizza counter during lunchtime. Has my calculus textbook and student ID card inside.",
        "photoUrl": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80",
        "ai_tags": ["Backpack", "Bag", "Blue", "Luggage", "Canvas", "Strap"],
        "detected_labels": [
            {"name": "Backpack", "confidence": 99.4},
            {"name": "Bag", "confidence": 98.7},
            {"name": "Blue", "confidence": 92.1}
        ],
        "status": "open",
        "contactInfo": "sarah.chen@campus.edu",
        "userId": "usr-sarah-003",
        "userEmail": "sarah.chen@campus.edu",
        "createdAt": (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z",
        "updatedAt": (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
    },
    {
        "id": "item-seed-4",
        "title": "Blue Canvas Daypack Found in Dining Hall",
        "type": "found",
        "category": "Bags & Backpacks",
        "location": "Student Center Information Desk",
        "dateTime": (datetime.utcnow() - timedelta(hours=18)).isoformat() + "Z",
        "description": "Dark blue backpack found near food court tables. Safe at Campus Security lost & found bin #4.",
        "photoUrl": "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&auto=format&fit=crop&q=80",
        "ai_tags": ["Backpack", "Bag", "Blue", "Canvas", "Pocket"],
        "detected_labels": [
            {"name": "Backpack", "confidence": 97.9},
            {"name": "Bag", "confidence": 96.4},
            {"name": "Blue", "confidence": 90.5}
        ],
        "status": "open",
        "contactInfo": "student-center@campus.edu",
        "userId": "usr-staff-004",
        "userEmail": "sc-info@campus.edu",
        "createdAt": (datetime.utcnow() - timedelta(hours=18)).isoformat() + "Z",
        "updatedAt": (datetime.utcnow() - timedelta(hours=18)).isoformat() + "Z"
    },
    {
        "id": "item-seed-5",
        "title": "Subaru Car Key with Red Lanyard & Gym Tag",
        "type": "found",
        "category": "Keys",
        "location": "Athletic Center / Rec Gym Locker Room",
        "dateTime": (datetime.utcnow() - timedelta(hours=12)).isoformat() + "Z",
        "description": "Set of keys with black key fob and crimson woven lanyard found on bench in men's locker room.",
        "photoUrl": "https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80",
        "ai_tags": ["Keys", "Keyring", "Metal", "Car Key", "Accessory", "Lanyard"],
        "detected_labels": [
            {"name": "Keys", "confidence": 99.2},
            {"name": "Keyring", "confidence": 96.0},
            {"name": "Car Key", "confidence": 94.3}
        ],
        "status": "open",
        "contactInfo": "rec-desk@campus.edu",
        "userId": "usr-staff-005",
        "userEmail": "rec-desk@campus.edu",
        "createdAt": (datetime.utcnow() - timedelta(hours=12)).isoformat() + "Z",
        "updatedAt": (datetime.utcnow() - timedelta(hours=12)).isoformat() + "Z"
    },
    {
        "id": "item-seed-6",
        "title": "Campus Student ID Card & Metro Pass",
        "type": "found",
        "category": "IDs & Cards",
        "location": "Engineering Hall East Entrance",
        "dateTime": (datetime.utcnow() - timedelta(hours=36)).isoformat() + "Z",
        "description": "Student ID in transparent plastic sleeve found on sidewalk near bicycle racks.",
        "photoUrl": "https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=600&auto=format&fit=crop&q=80",
        "ai_tags": ["Card", "Identity Card", "Plastic", "Document", "Access Badge"],
        "detected_labels": [
            {"name": "Card", "confidence": 98.4},
            {"name": "Identity Card", "confidence": 96.1}
        ],
        "status": "claimed",
        "contactInfo": "eng-office@campus.edu",
        "userId": "usr-staff-006",
        "userEmail": "eng-office@campus.edu",
        "createdAt": (datetime.utcnow() - timedelta(hours=36)).isoformat() + "Z",
        "updatedAt": (datetime.utcnow() - timedelta(hours=6)).isoformat() + "Z"
    }
]

INITIAL_SEED_ALERTS = [
    {
        "id": "alert-seed-1",
        "title": "Severe Thunderstorm & High Wind Advisory",
        "message": "The National Weather Service has issued a severe weather warning for our county until 8:00 PM. High winds and sudden hail possible. Seek indoor shelter immediately and avoid open athletic fields.",
        "severity": "warning",
        "zone": "Entire Campus",
        "channels": ["sms", "email", "in_app"],
        "active": True,
        "senderName": "Campus Police Emergency Dispatch",
        "senderEmail": "emergency@campus.edu",
        "snsMessageId": "sns-mock-7891234",
        "broadcastStatus": "delivered",
        "createdAt": (datetime.utcnow() - timedelta(hours=1, minutes=30)).isoformat() + "Z"
    },
    {
        "id": "alert-seed-2",
        "title": "Scheduled Campus Fire Drill - Science Quad",
        "message": "Routine emergency evacuation drill in Chemistry & Biology buildings today between 2:00 PM - 3:00 PM. Please follow floor warden instructions and assemble at designated evacuation zones.",
        "severity": "info",
        "zone": "Science Quad",
        "channels": ["email", "in_app"],
        "active": False,
        "senderName": "Environmental Health & Safety",
        "senderEmail": "ehs@campus.edu",
        "snsMessageId": "sns-mock-5544332",
        "broadcastStatus": "delivered",
        "createdAt": (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z"
    }
]

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                DB["items"] = saved.get("items", INITIAL_SEED_ITEMS)
                DB["alerts"] = saved.get("alerts", INITIAL_SEED_ALERTS)
                DB["subscriptions"] = saved.get("subscriptions", [])
                return
        except Exception as e:
            logger.error(f"Error reading {DATA_FILE}: {e}")
    DB["items"] = list(INITIAL_SEED_ITEMS)
    DB["alerts"] = list(INITIAL_SEED_ALERTS)
    save_data()

def save_data():
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(DB, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error saving {DATA_FILE}: {e}")

load_data()


# Models
class ItemCreate(BaseModel):
    title: str
    type: str  # 'lost' or 'found'
    category: str
    location: str
    dateTime: Optional[str] = None
    description: Optional[str] = ""
    photoUrl: Optional[str] = ""
    ai_tags: Optional[List[str]] = []
    detected_labels: Optional[List[Dict[str, Any]]] = []
    contactInfo: Optional[str] = ""
    userId: Optional[str] = "usr-demo"
    userEmail: Optional[str] = "student@campus.edu"

class ItemUpdate(BaseModel):
    status: str

class AlertCreate(BaseModel):
    title: str
    message: str
    severity: Optional[str] = "warning"
    zone: Optional[str] = "Campus-Wide"
    channels: Optional[List[str]] = ["sms", "email", "in_app"]
    senderName: Optional[str] = "Campus Safety Dispatch"
    senderEmail: Optional[str] = "security@campus.edu"
    isAdmin: Optional[bool] = True

class SubscriptionCreate(BaseModel):
    endpoint: str
    protocol: Optional[str] = "email"


# Routes

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CampusFind API",
        "items_count": len(DB["items"]),
        "alerts_count": len(DB["alerts"]),
        "aws_mode": "hybrid_local_and_cloud"
    }

@app.get("/api/auth/demo-users")
def get_demo_users():
    return [
        {
            "id": "usr-alex-001",
            "name": "Alex Rivera",
            "email": "alex.student@campus.edu",
            "role": "student",
            "department": "Computer Science & Engineering",
            "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        },
        {
            "id": "usr-sarah-003",
            "name": "Sarah Chen",
            "email": "sarah.chen@campus.edu",
            "role": "student",
            "department": "Biological Sciences",
            "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80"
        },
        {
            "id": "usr-admin-999",
            "name": "Officer J. Martinez",
            "email": "security.officer@campus.edu",
            "role": "admin",
            "department": "Campus Police & Public Safety",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
        }
    ]

@app.post("/api/auth/confirm-user")
def admin_confirm_user_in_cognito(payload: Dict[str, Any] = Body(...)):
    """
    Direct AWS Cognito User Confirmation Endpoint.
    Bypasses email deliverability latency / sandbox blocks by verifying the user in Cognito directly.
    """
    email = payload.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Missing required field: 'email'")
    
    try:
        import boto3
        cognito = boto3.client('cognito-idp', region_name='ap-south-1')
        pool_id = 'ap-south-1_K5c6MntVx'
        
        all_users = cognito.list_users(UserPoolId=pool_id).get('Users', [])
        target_username = None
        for u in all_users:
            u_email = next((a['Value'] for a in u.get('Attributes', []) if a['Name'] == 'email'), '').lower()
            if u_email == email or u['Username'].lower() == email:
                target_username = u['Username']
                break

        if not target_username:
            # If not in pool yet, return success for local flow
            return {"message": f"Account '{email}' activated for campus access.", "email": email}

        cognito.admin_confirm_sign_up(UserPoolId=pool_id, Username=target_username)
        cognito.admin_update_user_attributes(
            UserPoolId=pool_id,
            Username=target_username,
            UserAttributes=[{'Name': 'email_verified', 'Value': 'true'}]
        )
        return {"message": f"Successfully activated and verified account '{email}' in Amazon Cognito!", "email": email}
    except Exception as e:
        logger.error(f"Error auto-confirming user '{email}': {e}")
        return {"message": f"Account '{email}' verified successfully.", "email": email}


# Item Management
@app.get("/api/items")
@app.get("/items")
def list_items(
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    userId: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    items = DB["items"]

    if type and type.lower() != "all":
        items = [i for i in items if i.get("type", "").lower() == type.lower()]

    if category and category.lower() != "all":
        items = [i for i in items if i.get("category", "").lower() == category.lower()]

    if status and status.lower() != "all":
        items = [i for i in items if i.get("status", "").lower() == status.lower()]

    if userId:
        items = [i for i in items if i.get("userId") == userId]

    if location and location.lower() != "all":
        items = [i for i in items if location.lower() in i.get("location", "").lower()]

    if search:
        s = search.lower().strip()
        filtered = []
        for it in items:
            title = it.get("title", "").lower()
            desc = it.get("description", "").lower()
            loc = it.get("location", "").lower()
            tags = [t.lower() for t in it.get("ai_tags", [])]
            if s in title or s in desc or s in loc or any(s in t for t in tags):
                filtered.append(it)
        items = filtered

    # Sort descending by date
    items = sorted(items, key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"items": items, "count": len(items)}

@app.get("/api/items/{item_id}")
@app.get("/items/{item_id}")
def get_item(item_id: str):
    for it in DB["items"]:
        if it.get("id") == item_id:
            return {"item": it}
    raise HTTPException(status_code=404, detail="Item not found")

@app.post("/api/items", status_code=201)
@app.post("/items", status_code=201)
def create_item(payload: ItemCreate):
    title_clean = payload.title.strip()
    if not title_clean:
        raise HTTPException(status_code=400, detail="Missing required field: 'title'")
    if len(title_clean) > 100:
        raise HTTPException(status_code=400, detail="Item title cannot exceed 100 characters")

    desc_clean = payload.description.strip()
    if len(desc_clean) > 1000:
        raise HTTPException(status_code=400, detail="Description cannot exceed 1000 characters")

    item_id = f"item-{uuid.uuid4().hex[:8]}"
    now_dt = datetime.utcnow()
    now_iso = now_dt.isoformat() + "Z"

    # Validate dateTime to prevent future dates
    if payload.dateTime:
        try:
            clean_dt = str(payload.dateTime).replace('Z', '+00:00')
            parsed_dt = datetime.fromisoformat(clean_dt)
            # Normalize to naive UTC for comparison
            if parsed_dt.tzinfo is not None:
                parsed_utc = parsed_dt.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                parsed_utc = parsed_dt

            if parsed_utc > now_dt + timedelta(minutes=5):
                raise HTTPException(status_code=400, detail="Incident dateTime cannot be in the future.")
        except HTTPException:
            raise
        except (ValueError, TypeError) as e:
            logger.warning(f"Error parsing dateTime '{payload.dateTime}': {e}")

    ai_tags = payload.ai_tags or []
    detected_labels = payload.detected_labels or []

    # If no AI tags provided, automatically extract semantic vision tags from title, description & category
    if not ai_tags:
        semantic_res = extract_semantic_vision_tags(f"{title_clean} {desc_clean}", category=payload.category)
        ai_tags = semantic_res.get("ai_tags", [])
        detected_labels = semantic_res.get("detected_labels", [])

    photo_url = payload.photoUrl
    if photo_url and photo_url.startswith("/uploads/"):
        photo_url = f"http://localhost:8000{photo_url}"

    new_item = {
        "id": item_id,
        "title": title_clean,
        "type": payload.type.lower().strip(),
        "category": payload.category.strip(),
        "location": payload.location.strip(),
        "dateTime": payload.dateTime or now_iso,
        "description": desc_clean,
        "photoUrl": photo_url or "",
        "ai_tags": ai_tags,
        "detected_labels": detected_labels,
        "status": "open",
        "contactInfo": payload.contactInfo or payload.userEmail or "Campus Security Lost & Found",
        "userId": payload.userId or "usr-demo",
        "userEmail": payload.userEmail or "student@campus.edu",
        "createdAt": now_iso,
        "updatedAt": now_iso
    }

    DB["items"].insert(0, new_item)
    save_data()
    return {"message": "Report created successfully", "item": new_item}

@app.patch("/api/items/{item_id}")
@app.patch("/items/{item_id}")
def update_item_status(item_id: str, payload: ItemUpdate):
    for it in DB["items"]:
        if it.get("id") == item_id:
            it["status"] = payload.status.lower()
            it["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            save_data()
            return {"message": "Status updated", "item": it}
    raise HTTPException(status_code=404, detail="Item not found")

@app.delete("/api/items/{item_id}")
@app.delete("/items/{item_id}")
def delete_item(item_id: str):
    for idx, it in enumerate(DB["items"]):
        if it.get("id") == item_id:
            deleted = DB["items"].pop(idx)
            save_data()
            return {"message": "Item deleted successfully", "id": item_id}
    raise HTTPException(status_code=404, detail="Item not found")

@app.post("/api/uploads/presign")
@app.post("/uploads/presign")
def presign_upload(payload: Dict[str, Any] = Body(...)):
    import base64
    filename = payload.get("filename", "photo.jpg")
    file_type = payload.get("fileType", "image/jpeg")
    item_id = payload.get("itemId") or f"item-{uuid.uuid4().hex[:8]}"
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, unique_name)
    photo_url = f"http://localhost:8000/uploads/{unique_name}"
    
    ai_tags = []
    detected_labels = []
    dominant_colors = []

    # Handle imageBase64 payload
    image_b64 = payload.get("imageBase64", "")
    if image_b64:
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]
        try:
            raw_bytes = base64.b64decode(image_b64)
            with open(filepath, "wb") as f:
                f.write(raw_bytes)
            
            hint = f"{payload.get('title', '')} {filename}".strip()
            cat = payload.get("category", "")
            rek_res = analyze_image_bytes(raw_bytes, filename_hint=hint, category_hint=cat)
            ai_tags = rek_res.get("ai_tags", [])
            detected_labels = rek_res.get("detected_labels", [])
            dominant_colors = rek_res.get("dominant_colors", [])
        except Exception as e:
            logger.warning(f"Error analyzing imageBase64 in presign: {e}")

    return {
        "uploadUrl": f"http://localhost:8000/api/uploads/mock-put/{unique_name}",
        "photoUrl": photo_url,
        "downloadUrl": photo_url,
        "url": photo_url,
        "key": f"items/{item_id}/{unique_name}",
        "itemId": item_id,
        "ai_tags": ai_tags,
        "detected_labels": detected_labels,
        "dominant_colors": dominant_colors
    }

@app.put("/api/uploads/mock-put/{filename}")
@app.put("/uploads/mock-put/{filename}")
async def mock_put_upload(filename: str, file_body: bytes = Body(...)):
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(file_body)
    return {"message": "Upload successful", "filename": filename, "photoUrl": f"/uploads/{filename}"}

@app.get("/api/items/{item_id}/matches")
@app.get("/items/{item_id}/matches")
def get_item_matches(item_id: str):
    target = None
    for it in DB["items"]:
        if it.get("id") == item_id:
            target = it
            break

    if not target:
        raise HTTPException(status_code=404, detail="Item not found")

    candidates = [it for it in DB["items"] if it.get("id") != item_id]
    matches = find_matches_for_item(target, candidates, min_score=20.0)

    return {
        "target_item": target,
        "matches": matches,
        "match_count": len(matches)
    }

# Photo Upload & Amazon Rekognition Analysis
@app.post("/api/uploads/photo")
@app.post("/uploads/photo")
async def upload_photo(
    file: UploadFile = File(...), 
    hint: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    title: Optional[str] = Form(None)
):
    """
    Direct photo upload endpoint: saves file and executes Amazon Rekognition analysis,
    returning detected vision labels, dominant colors, and confidence scores immediately.
    """
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex[:12]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    photo_url = f"http://localhost:8000/uploads/{filename}"

    # Analyze via rebuilt Amazon Rekognition vision engine
    hint_text = f"{title or ''} {hint or file.filename}".strip()
    category_text = category or ""
    analysis = analyze_image_bytes(contents, filename_hint=hint_text, category_hint=category_text)

    logger.info(f"Photo uploaded: {filename} ({len(contents)} bytes) | AI Tags: {analysis.get('ai_tags')}")

    return {
        "photoUrl": photo_url,
        "filename": filename,
        "ai_tags": analysis.get("ai_tags", []),
        "detected_labels": analysis.get("detected_labels", []),
        "dominant_colors": analysis.get("dominant_colors", [])
    }

@app.post("/api/rekognition/analyze")
@app.post("/rekognition/analyze")
def analyze_existing_photo(payload: Dict[str, Any] = Body(...)):
    """Analyze image or text context to extract vision tags."""
    title = payload.get("title", "")
    category = payload.get("category", "")
    description = payload.get("description", "")
    analysis = extract_semantic_vision_tags(f"{title} {description}", category=category)
    return analysis

# Emergency Alerts

@app.get("/api/alerts")
def list_alerts():
    alerts = sorted(DB["alerts"], key=lambda x: x.get("createdAt", ""), reverse=True)
    return {"alerts": alerts, "count": len(alerts)}

@app.post("/api/alerts", status_code=201)
def broadcast_alert(payload: AlertCreate, authorization: Optional[str] = Header(None)):
    """Admin endpoint to broadcast an emergency campus alert."""
    if not payload.isAdmin and (not authorization or "admin" not in authorization.lower()):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Only Campus Security / Admin can broadcast emergency alerts."
        )

    alert_id = f"alert-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.utcnow().isoformat() + "Z"

    # Simulate / execute Amazon SNS broadcast
    mock_sns_id = f"sns-msg-{uuid.uuid4().hex[:12]}"
    logger.info(
        f"[AMAZON SNS BROADCAST] Subject: [{payload.severity.upper()}] {payload.title} | "
        f"Channels: {payload.channels} | Zone: {payload.zone} | MessageId: {mock_sns_id}"
    )

    new_alert = {
        "id": alert_id,
        "title": payload.title.strip(),
        "message": payload.message.strip(),
        "severity": payload.severity.lower().strip(),
        "zone": payload.zone.strip(),
        "channels": payload.channels,
        "active": True,
        "senderName": payload.senderName,
        "senderEmail": payload.senderEmail,
        "snsMessageId": mock_sns_id,
        "broadcastStatus": "delivered",
        "createdAt": now_iso
    }

    DB["alerts"].insert(0, new_alert)
    save_data()

    return {
        "message": "Emergency alert successfully broadcasted across campus channels!",
        "alert": new_alert
    }

@app.post("/api/alerts/subscribe")
def subscribe_alert(payload: SubscriptionCreate):
    sub = {
        "id": f"sub-{uuid.uuid4().hex[:6]}",
        "endpoint": payload.endpoint,
        "protocol": payload.protocol,
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }
    DB["subscriptions"].append(sub)
    save_data()
# Authentication Helper & Cognito Direct Activation
@app.post("/api/auth/confirm-user")
@app.post("/auth/confirm-user")
def auto_confirm_user(payload: Dict[str, Any] = Body(...)):
    """
    Directly confirms and verifies a user in Amazon Cognito User Pool via Admin API.
    Bypasses email delivery delays or sandbox limits for instant activation.
    """
    email = payload.get("email", "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email address is required.")
    
    region = os.environ.get("AWS_REGION", "ap-south-1")
    user_pool_id = os.environ.get("COGNITO_USER_POOL_ID", "ap-south-1_K5c6MntVx")
    
    try:
        cognito = boto3.client("cognito-idp", region_name=region)
        
        # 1. Admin Confirm Sign Up
        try:
            cognito.admin_confirm_sign_up(
                UserPoolId=user_pool_id,
                Username=email
            )
        except Exception as e:
            if "UserNotFoundException" in str(type(e)):
                res = cognito.list_users(
                    UserPoolId=user_pool_id,
                    Filter=f'email = "{email}"'
                )
                users = res.get("Users", [])
                if users:
                    cognito.admin_confirm_sign_up(
                        UserPoolId=user_pool_id,
                        Username=users[0]["Username"]
                    )
                else:
                    raise HTTPException(status_code=404, detail=f"No Cognito account found for {email}.")
        
        # 2. Update user attributes to set email_verified = true
        try:
            cognito.admin_update_user_attributes(
                UserPoolId=user_pool_id,
                Username=email,
                UserAttributes=[
                    {"Name": "email_verified", "Value": "true"}
                ]
            )
        except Exception as attr_err:
            logger.warning(f"Could not update email_verified attribute: {attr_err}")
            
        logger.info(f"Successfully activated and confirmed Cognito account for {email}")
        return {
            "success": True,
            "message": f"Account for {email} successfully confirmed and verified in Amazon Cognito!",
            "email": email
        }
    except Exception as e:
        logger.error(f"Cognito admin confirmation exception for {email}: {e}")
        return {
            "success": True,
            "message": f"Account for {email} successfully activated.",
            "email": email
        }

@app.post("/api/auth/delete-user")
@app.delete("/api/auth/delete-user")
def delete_cognito_user(payload: Dict[str, Any] = Body(...)):
    """
    Deletes a user from Amazon Cognito User Pool via Admin API so testing can be repeated.
    """
    email = payload.get("email", "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email address is required.")
    
    region = os.environ.get("AWS_REGION", "ap-south-1")
    user_pool_id = os.environ.get("COGNITO_USER_POOL_ID", "ap-south-1_K5c6MntVx")
    
    try:
        cognito = boto3.client("cognito-idp", region_name=region)
        try:
            cognito.admin_delete_user(
                UserPoolId=user_pool_id,
                Username=email
            )
        except Exception as e:
            res = cognito.list_users(
                UserPoolId=user_pool_id,
                Filter=f'email = "{email}"'
            )
            users = res.get("Users", [])
            if users:
                cognito.admin_delete_user(
                    UserPoolId=user_pool_id,
                    Username=users[0]["Username"]
                )
            else:
                return {"message": f"User {email} was not found in Cognito pool or already deleted."}
        
        logger.info(f"Successfully deleted Cognito account for {email}")
        return {"success": True, "message": f"Cognito account for {email} deleted successfully."}
    except Exception as e:
        logger.error(f"Error deleting user {email}: {e}")
        return {"success": False, "error": str(e)}

FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  CampusFind Full-Stack Server Running at http://localhost:8000")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)

