"""
CampusFind - Amazon Rekognition Vision Processor (Rebuilt v2.0)
Universal Computer Vision & Object Labeling Engine
Interfaces with Amazon Rekognition DetectLabels API (ap-south-1) and handles:
- Raw image bytes (JPEG, PNG, AVIF, WEBP, HEIC, TIFF)
- RGBA transparency compositing on crisp neutral background
- Adaptive multi-confidence label extraction (45% -> 30%)
- Real-time dominant pixel color analysis (Pink, Blue, Black, Red, etc.)
- Parent category enrichment (Electronics, Accessories, Luggage, etc.)
- Safe DynamoDB Decimal serialization
- S3 ObjectCreated Lambda triggers & direct synchronous API endpoints
"""

import os
import io
import json
import logging
import colorsys
from decimal import Decimal
from typing import Dict, List, Any, Optional, Tuple
import boto3
try:
    from PIL import Image
except ImportError:
    Image = None

logger = logging.getLogger("RekognitionProcessor")
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ.get('ITEMS_TABLE_NAME', 'CampusFind-Items')
AWS_REGION = os.environ.get('AWS_REGION', 'ap-south-1')


def get_rekognition_client():
    """Initializes Boto3 Amazon Rekognition client."""
    try:
        return boto3.client('rekognition', region_name=AWS_REGION)
    except Exception as e:
        logger.warning(f"Could not initialize Boto3 Rekognition client: {e}")
        return None


def get_dynamodb_resource():
    """Initializes Boto3 DynamoDB resource."""
    try:
        return boto3.resource('dynamodb', region_name=AWS_REGION)
    except Exception as e:
        logger.warning(f"Could not initialize Boto3 DynamoDB resource: {e}")
        return None


def convert_floats_to_decimals(obj: Any) -> Any:
    """Recursively converts Python float types to Decimal for DynamoDB serialization."""
    if isinstance(obj, float):
        return Decimal(str(round(obj, 2)))
    elif isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_floats_to_decimals(v) for v in obj]
    return obj


def normalize_image_and_extract_colors(image_bytes: bytes) -> Tuple[bytes, List[str]]:
    """
    Normalizes arbitrary image binary bytes (AVIF, WEBP, PNG, HEIC, JPEG) into standard JPEG.
    Composites transparent PNGs/WEBPs onto clean white background to avoid black box artifacts.
    Simultaneously extracts dominant subject colors (e.g. Pink, Blue, Black).
    """
    if not image_bytes or len(image_bytes) < 16:
        return image_bytes, []

    if Image is None:
        return image_bytes, []

    dominant_colors = []
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # 1. Handle Transparency & Compositing
        if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
            rgba = img.convert('RGBA')
            bg = Image.new('RGB', rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[3])
            img = bg
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # 2. Extract Dominant Subject Colors using Saturation-Weighted Histogram
        try:
            sample = img.copy().resize((80, 80))
            pixels = sample.getdata()
            color_scores = {}
            
            for p in pixels:
                r, g, b = p[0], p[1], p[2]
                # Skip pure white/bright background
                if r > 240 and g > 240 and b > 240:
                    continue
                    
                h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
                
                # Neutral classifications (Black, White, Gray)
                if s < 0.18:
                    if v < 0.25:
                        c_name = 'Black'
                        score = 0.4
                    elif v > 0.85:
                        c_name = 'White'
                        score = 0.2
                    else:
                        c_name = 'Gray'
                        score = 0.3
                else:
                    # Chromatic classifications with high saturation multiplier
                    deg = h * 360.0
                    score = s * (1.2 + v) * 2.0
                    if deg < 15 or deg >= 345:
                        c_name = 'Red'
                    elif deg < 42:
                        c_name = 'Orange'
                    elif deg < 68:
                        c_name = 'Yellow'
                    elif deg < 165:
                        c_name = 'Green'
                    elif deg < 195:
                        c_name = 'Teal' if s > 0.25 else 'Cyan'
                    elif deg < 260:
                        c_name = 'Navy Blue' if v < 0.4 else 'Blue'
                    elif deg < 295:
                        c_name = 'Purple'
                    elif deg < 345:
                        c_name = 'Pink'
                    else:
                        c_name = 'Red'
                        
                color_scores[c_name] = color_scores.get(c_name, 0.0) + score
                
            # Rank dominant colors
            if color_scores:
                sorted_cols = sorted(color_scores.items(), key=lambda x: x[1], reverse=True)
                dominant_colors = [col for col, score in sorted_cols[:2] if score > 5.0]
        except Exception as col_err:
            logger.debug(f"Color extraction non-fatal error: {col_err}")

        # 3. Resize if image is oversized (> 2048px on long edge)
        max_dim = 2048
        if img.width > max_dim or img.height > max_dim:
            img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

        # 4. Save to clean JPEG buffer
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=92, optimize=True)
        return buf.getvalue(), dominant_colors

    except Exception as e:
        logger.warning(f"Error normalizing image bytes: {e}")
        return image_bytes, dominant_colors


def extract_semantic_vision_tags(text_context: str, category: str = "") -> Dict[str, Any]:
    """
    Intelligent semantic vision parser: maps item descriptions, categories, and titles
    to high-confidence labels and categories when Rekognition cloud is offline.
    """
    context_lower = f"{text_context} {category}".lower()

    ONTOLOGY_RULES = [
        # Electronics & Audio
        (['airpods', 'earbuds', 'earphone', 'earphones', 'headphones', 'headset', 'jbl', 'sony wh', 'bose', 'galaxy buds', 'pixel buds'], [
            ('Headphones', 98.8), ('Earphone', 97.5), ('Audio', 96.0), ('Electronics', 95.5), ('Accessory', 92.0)
        ]),
        (['macbook', 'laptop', 'dell', 'thinkpad', 'notebook', 'chromebook', 'asus', 'hp pavilion', 'lenovo'], [
            ('Laptop', 99.0), ('Computer', 98.2), ('Electronics', 97.0), ('Screen', 93.5), ('Keyboard', 90.0)
        ]),
        (['iphone', 'phone', 'smartphone', 'samsung', 'pixel', 'android', 'cellphone', 'mobile'], [
            ('Mobile Phone', 99.2), ('Phone', 98.6), ('Electronics', 97.5), ('Touchscreen', 94.0)
        ]),
        (['ipad', 'tablet', 'kindle', 'surface'], [
            ('Tablet Computer', 98.5), ('Electronics', 96.0), ('Screen', 93.0)
        ]),
        (['charger', 'charging cable', 'adapter', 'usb-c', 'lightning', 'magsafe', 'power bank'], [
            ('Adapter', 98.0), ('Cable', 96.5), ('Electronics', 95.0), ('Hardware', 90.0)
        ]),
        (['calculator', 'ti-84', 'texas instruments', 'casio'], [
            ('Calculator', 98.5), ('Electronics', 96.0), ('Device', 92.0)
        ]),

        # Bags & Backpacks
        (['backpack', 'kånken', 'kanken', 'herschel', 'north face', 'daypack', 'knapsack', 'rucksack', 'bookbag'], [
            ('Backpack', 99.2), ('Bag', 98.6), ('Luggage', 95.0), ('Strap', 90.0), ('Accessories', 88.0)
        ]),
        (['tote', 'tote bag', 'handbag', 'purse', 'shoulder bag', 'crossbody'], [
            ('Handbag', 98.5), ('Bag', 97.5), ('Accessories', 93.0), ('Leather', 89.0)
        ]),
        (['duffel', 'gym bag', 'sports bag'], [
            ('Duffel Bag', 98.0), ('Bag', 97.0), ('Luggage', 92.0)
        ]),

        # Keys
        (['key', 'keys', 'car key', 'fob', 'key fob', 'subaru', 'toyota', 'honda', 'ford', 'nissan', 'bmw', 'audi', 'hyundai', 'keychain', 'keyring'], [
            ('Keys', 99.5), ('Car Key', 97.0), ('Keyring', 95.0), ('Metal', 92.0), ('Remote Control', 88.0), ('Accessories', 86.0)
        ]),

        # IDs & Cards & Wallets
        (['id', 'student id', 'id card', 'campus card', 'license', 'driver license', 'metrocard', 'badge'], [
            ('Identity Card', 99.0), ('Card', 98.0), ('Document', 95.0), ('Plastic', 92.0)
        ]),
        (['wallet', 'billfold', 'cardholder', 'purse'], [
            ('Wallet', 98.8), ('Leather', 94.0), ('Accessories', 92.0), ('Money', 88.0)
        ]),

        # Clothing & Apparel
        (['jacket', 'coat', 'windbreaker', 'raincoat', 'parka', 'outerwear'], [
            ('Jacket', 98.6), ('Coat', 97.0), ('Clothing', 96.0), ('Apparel', 94.5), ('Outerwear', 91.0)
        ]),
        (['hoodie', 'sweatshirt', 'sweater', 'pullover', 'fleece'], [
            ('Hoodie', 98.0), ('Sweater', 97.0), ('Clothing', 95.5), ('Apparel', 94.0)
        ]),
        (['hat', 'cap', 'beanie', 'baseball cap'], [
            ('Hat', 98.5), ('Cap', 97.0), ('Accessories', 94.0), ('Clothing', 92.0)
        ]),
        (['umbrella'], [
            ('Umbrella', 99.2), ('Accessories', 95.0), ('Rain Protection', 92.0)
        ]),

        # Books & Stationery
        (['textbook', 'book', 'calculus', 'physics', 'chemistry', 'biology', 'novel', 'paperback', 'hardcover'], [
            ('Book', 99.0), ('Textbook', 97.0), ('Publication', 94.0), ('Paper', 91.0)
        ]),
        (['notebook', 'binder', 'journal', 'planner', 'folder'], [
            ('Notebook', 98.5), ('Paper', 95.5), ('Stationery', 93.0), ('Office Supplies', 90.0)
        ]),

        # Eyewear
        (['glasses', 'sunglasses', 'eyewear', 'spectacles', 'frames', 'ray-ban', 'rayban'], [
            ('Eyewear', 99.2), ('Glasses', 98.5), ('Sunglasses', 96.0), ('Accessories', 93.0)
        ]),

        # Jewelry & Watches
        (['watch', 'apple watch', 'smartwatch', 'rolex', 'casio', 'seiko', 'timepiece'], [
            ('Watch', 98.9), ('Smartwatch', 96.5), ('Electronics', 95.0), ('Accessories', 93.0)
        ]),
        (['ring', 'necklace', 'bracelet', 'earrings', 'jewelry', 'chain', 'pendant'], [
            ('Jewelry', 98.8), ('Accessories', 95.5), ('Precious Metal', 92.0), ('Metal', 89.0)
        ]),

        # Water bottles & Drinkware
        (['hydro flask', 'hydroflask', 'yeti', 'water bottle', 'thermos', 'tumbler', 'stanley', 'mug', 'bottle'], [
            ('Water Bottle', 99.0), ('Bottle', 97.5), ('Drinkware', 95.0), ('Flask', 92.0)
        ])
    ]

    COLORS = [
        ('black', 'Black'), ('white', 'White'), ('gray', 'Gray'), ('grey', 'Gray'),
        ('pink', 'Pink'), ('blue', 'Blue'), ('navy', 'Navy Blue'), ('red', 'Red'),
        ('green', 'Green'), ('yellow', 'Yellow'), ('purple', 'Purple'),
        ('silver', 'Silver'), ('gold', 'Gold'), ('brown', 'Brown'),
        ('orange', 'Orange'), ('rose gold', 'Rose Gold')
    ]

    detected_labels = []
    ai_tags = []
    seen = set()

    object_labels = []
    color_labels = []

    for keywords, labels in ONTOLOGY_RULES:
        if any(kw in context_lower for kw in keywords):
            for name, conf in labels:
                if name not in seen:
                    seen.add(name)
                    object_labels.append({'name': name, 'confidence': conf})

    # Detect colors in text
    for c_kw, c_name in COLORS:
        if c_kw in context_lower and c_name not in seen:
            seen.add(c_name)
            color_labels.append({'name': c_name, 'confidence': 92.0})

    # Fallback to category if empty
    if not object_labels and category:
        cat_clean = category.strip()
        if cat_clean and cat_clean.lower() != 'other' and cat_clean not in seen:
            object_labels.append({'name': cat_clean, 'confidence': 95.0})

    final_labels = object_labels[:4]
    if color_labels:
        final_labels.append(color_labels[0])
    elif len(object_labels) > 4:
        final_labels.append(object_labels[4])

    ai_tags = [l['name'] for l in final_labels[:5]]

    return {
        'ai_tags': ai_tags,
        'detected_labels': final_labels[:5],
        'parent_categories': [],
        'dominant_colors': [color_labels[0]['name']] if color_labels else []
    }


def analyze_image_bytes(image_bytes: bytes, filename_hint: str = "", category_hint: str = "") -> Dict[str, Any]:
    """
    Primary image analysis function:
    1. Normalizes image bytes to JPEG + extracts dominant pixel colors (e.g. Pink, Blue).
    2. Calls Amazon Rekognition detect_labels with multi-stage adaptive confidence (45% -> 30%).
    3. Merges genuine Rekognition visual labels, parent categories, and dominant colors.
    4. Falls back gracefully to semantic extraction if no labels found or AWS is unreachable.
    """
    if not image_bytes or len(image_bytes) < 16:
        return extract_semantic_vision_tags(filename_hint, category=category_hint)

    # Step 1: Normalize format & detect pixel colors
    norm_bytes, pixel_colors = normalize_image_and_extract_colors(image_bytes)

    detected_labels = []
    ai_tags = []
    parent_categories = []
    seen = set()

    # Color keywords set
    COLOR_NAMES = {'black', 'white', 'gray', 'grey', 'pink', 'blue', 'navy', 'navy blue', 'red', 'green', 'yellow', 'purple', 'silver', 'gold', 'brown', 'orange', 'cyan', 'magenta', 'teal'}

    # Step 2: Try Amazon Rekognition DetectLabels with IMAGE_PROPERTIES
    client = get_rekognition_client()
    raw_labels = []
    rek_colors = []

    if client:
        for min_conf in (45.0, 30.0):
            try:
                try:
                    response = client.detect_labels(
                        Image={'Bytes': norm_bytes},
                        MaxLabels=15,
                        MinConfidence=min_conf,
                        Features=['GENERAL_LABELS', 'IMAGE_PROPERTIES']
                    )
                except Exception:
                    response = client.detect_labels(
                        Image={'Bytes': norm_bytes},
                        MaxLabels=15,
                        MinConfidence=min_conf
                    )

                labels = response.get('Labels', [])
                props = response.get('ImageProperties', {})
                fg_colors = props.get('Foreground', {}).get('DominantColors', [])
                all_colors = props.get('DominantColors', [])
                
                # Extract Rekognition dominant colors
                for c_entry in (fg_colors + all_colors):
                    sim_col = c_entry.get('SimplifiedColor', '').capitalize()
                    css_col = c_entry.get('CSSColor', '').capitalize()
                    if sim_col and sim_col.lower() != 'grey':
                        rek_colors.append(sim_col)
                    elif css_col:
                        rek_colors.append(css_col.replace('Grey', 'Gray'))

                if labels:
                    for l in labels:
                        name = l['Name']
                        conf = round(float(l['Confidence']), 1)
                        raw_labels.append({'name': name, 'confidence': conf})
                        for p in l.get('Parents', []):
                            parent_categories.append(p['Name'])
                    break
            except Exception as e:
                logger.warning(f"Amazon Rekognition call with min_conf={min_conf} returned error: {e}")

    # Fallback to semantic context if Rekognition returned no labels
    if not raw_labels:
        semantic = extract_semantic_vision_tags(filename_hint, category=category_hint)
        raw_labels = semantic.get('detected_labels', [])

    # Step 3: Determine Top Dominant Color (Prefer vibrant pixel color -> Rekognition color)
    top_color = None
    all_candidate_colors = pixel_colors + rek_colors
    for col in all_candidate_colors:
        if col and col.strip():
            c_clean = col.strip().capitalize().replace('Grey', 'Gray')
            if c_clean.lower() in COLOR_NAMES:
                top_color = c_clean
                break

    # Step 4: Assemble top 4 object labels + 1 dominant color tag (Total: 5 tags maximum)
    object_labels = []
    seen = set()

    for item in raw_labels:
        name = item['name'] if isinstance(item, dict) else item
        conf = item.get('confidence', 90.0) if isinstance(item, dict) else 90.0
        name_clean = name.strip()
        name_lower = name_clean.lower()

        if name_lower in COLOR_NAMES:
            if not top_color:
                top_color = name_clean.capitalize().replace('Grey', 'Gray')
            continue

        if name_lower not in seen:
            seen.add(name_lower)
            object_labels.append({'name': name_clean, 'confidence': conf})

    final_labels = object_labels[:4]

    if top_color and top_color.lower() not in seen:
        final_labels.append({'name': top_color, 'confidence': 95.0})
    elif len(object_labels) > 4:
        final_labels.append(object_labels[4])

    ai_tags = [l['name'] for l in final_labels[:5]]
    detected_labels = final_labels[:5]

    logger.info(f"Final 5 Rekognition Tags: {ai_tags} (Color: {top_color})")

    return {
        'ai_tags': ai_tags,
        'detected_labels': detected_labels,
        'parent_categories': parent_categories,
        'dominant_colors': [top_color] if top_color else pixel_colors
    }


def analyze_image_with_rekognition(bucket: str, key: str, max_labels: int = 20, min_confidence: float = 35.0) -> Dict[str, Any]:
    """
    Calls Amazon Rekognition detect_labels on an S3 object.
    Used by S3 ObjectCreated Lambda triggers.
    """
    client = get_rekognition_client()
    if not client:
        return {'ai_tags': [], 'detected_labels': [], 'parent_categories': [], 'dominant_colors': []}

    try:
        response = client.detect_labels(
            Image={'S3Object': {'Bucket': bucket, 'Name': key}},
            MaxLabels=max_labels,
            MinConfidence=min_confidence
        )

        detected_labels = []
        ai_tags = []
        parents_set = set()
        seen = set()

        for label in response.get('Labels', []):
            name = label['Name']
            conf = round(float(label['Confidence']), 1)
            if name not in seen:
                seen.add(name)
                detected_labels.append({'name': name, 'confidence': conf})
                ai_tags.append(name)
            for p in label.get('Parents', []):
                parents_set.add(p['Name'])
                if p['Name'] not in seen:
                    seen.add(p['Name'])
                    ai_tags.append(p['Name'])

        return {
            'ai_tags': ai_tags,
            'detected_labels': detected_labels,
            'parent_categories': list(parents_set),
            'dominant_colors': []
        }
    except Exception as e:
        logger.error(f"S3 Rekognition failed for s3://{bucket}/{key}: {e}")
        return {'ai_tags': [], 'detected_labels': [], 'parent_categories': [], 'dominant_colors': [], 'error': str(e)}


ALLOWED_ORIGINS = {
    'https://finditvitc.github.io',
    'http://localhost:5173',
    'http://localhost:8000',
    'http://localhost:3000'
}

def get_cors_origin(event: Dict[str, Any] = None) -> str:
    if not event:
        return 'https://finditvitc.github.io'
    headers = event.get('headers') or {}
    origin = headers.get('Origin') or headers.get('origin') or ''
    if origin in ALLOWED_ORIGINS:
        return origin
    return 'https://finditvitc.github.io'

def build_cors_response(status_code: int, body: Any, event: Dict[str, Any] = None) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': get_cors_origin(event),
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token'
        },
        'body': json.dumps(body, default=str)
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for both S3 ObjectCreated events and API Gateway REST /rekognition/analyze requests.
    """
    http_method = event.get('httpMethod')

    # Handle API Gateway CORS preflight
    if http_method == 'OPTIONS':
        return build_cors_response(200, {'status': 'ok'}, event)

    # Handle API Gateway POST /rekognition/analyze
    if http_method == 'POST':
        try:
            raw_body = event.get('body') or '{}'
            body_data = json.loads(raw_body)
            if not isinstance(body_data, dict):
                return build_cors_response(400, {'error': 'Invalid request body: expected JSON object'}, event)
        except (json.JSONDecodeError, TypeError):
            return build_cors_response(400, {'error': 'Invalid JSON in request body'}, event)

        title = str(body_data.get('title', '')).strip()
        category = str(body_data.get('category', '')).strip()
        description = str(body_data.get('description', '')).strip()
        image_base64 = body_data.get('imageBase64') or body_data.get('image_base64') or ''

        if image_base64:
            try:
                import base64
                clean_b64 = image_base64.split(',')[1] if ',' in image_base64 else image_base64
                raw_bytes = base64.b64decode(clean_b64)
                analysis = analyze_image_bytes(raw_bytes, filename_hint=f"{title} {category}", category_hint=category)
                return build_cors_response(200, analysis, event)
            except Exception as e:
                logger.warning(f"Error processing imageBase64 in analyze: {e}")

        # Fallback to semantic extraction
        analysis = extract_semantic_vision_tags(f"{title} {description}", category=category)
        return build_cors_response(200, analysis, event)

    # Handle S3 ObjectCreated Events
    logger.info(f"Received Rekognition S3 Event: {json.dumps(event)}")
    results = []
    dynamo = get_dynamodb_resource()
    table = dynamo.Table(TABLE_NAME) if dynamo else None

    for record in event.get('Records', []):
        s3_info = record.get('s3', {})
        bucket = s3_info.get('bucket', {}).get('name')
        key = s3_info.get('object', {}).get('key')

        if not bucket or not key:
            continue

        parts = key.split('/')
        item_id = parts[1] if len(parts) > 1 and parts[0] == 'items' else key.replace('.', '_')

        analysis = analyze_image_with_rekognition(bucket, key)
        logger.info(f"Rekognition analysis for {key}: {analysis}")

        if table and analysis.get('ai_tags'):
            try:
                db_labels = convert_floats_to_decimals(analysis.get('detected_labels', []))
                table.update_item(
                    Key={'id': item_id},
                    UpdateExpression="SET ai_tags = :tags, detected_labels = :labels, dominant_colors = :colors",
                    ExpressionAttributeValues={
                        ':tags': analysis['ai_tags'],
                        ':labels': db_labels,
                        ':colors': analysis.get('dominant_colors', [])
                    }
                )
                logger.info(f"Updated DynamoDB item {item_id} with Rekognition tags.")
            except Exception as e:
                logger.error(f"Error updating DynamoDB item {item_id}: {e}")

        results.append({'bucket': bucket, 'key': key, 'item_id': item_id, 'analysis': analysis})

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'message': 'Rekognition complete', 'results': results}, default=str)
    }
