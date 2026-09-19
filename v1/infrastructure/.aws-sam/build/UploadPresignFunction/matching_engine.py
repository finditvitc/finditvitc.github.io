"""
CampusFind - AI Matching Engine
Computes match similarity scores between Lost and Found reports using:
1. Category Match (30% weight)
2. Amazon Rekognition Visual Tags & Colors (35% weight)
3. Campus Location Proximity / Zone Match (20% weight)
4. Title & Description Keyword Overlap (15% weight)
"""

import re
from typing import List, Dict, Any, Tuple

# Common English stopwords to ignore in text matching
STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    'from', 'of', 'about', 'is', 'was', 'are', 'were', 'it', 'its', 'my', 'i',
    'lost', 'found', 'item', 'please', 'help', 'near', 'around', 'left', 'someone'
}

# Campus location clusters/aliases for normalized zone comparison
CAMPUS_ZONES = {
    'library': ['library', 'main library', 'science library', 'stacks', 'study room', 'lib'],
    'student_center': ['student center', 'union', 'campus center', 'food court', 'bookstore', 'lounge'],
    'science_complex': ['science hall', 'science building', 'biology', 'chemistry', 'physics', 'lab', 'quad'],
    'engineering_hall': ['engineering', 'eng hall', 'maker space', 'computer lab', 'robotics'],
    'athletics': ['gym', 'fitness center', 'stadium', 'rec center', 'field house', 'pool', 'arena'],
    'dining': ['dining hall', 'commons', 'cafeteria', 'cafe', 'bistro'],
    'dorms': ['dorm', 'residence hall', 'hall', 'north dorms', 'south dorms', 'apartment', 'quad']
}


def normalize_tokens(text: str) -> set:
    """Extract lowercase alphanumeric words, filtering stopwords."""
    if not text:
        return set()
    words = re.findall(r'[a-zA-Z0-9]+', text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 1}


def get_campus_zone(location_text: str) -> str:
    """Map a location string to a standardized campus zone if possible."""
    if not location_text:
        return ''
    loc_lower = location_text.lower()
    for zone, aliases in CAMPUS_ZONES.items():
        for alias in aliases:
            if alias in loc_lower:
                return zone
    return loc_lower.strip()


def calculate_category_score(cat1: str, cat2: str) -> Tuple[float, List[str]]:
    """Compare item categories."""
    reasons = []
    if not cat1 or not cat2:
        return 0.0, reasons
    c1, c2 = cat1.strip().lower(), cat2.strip().lower()
    if c1 == c2:
        reasons.append(f"Exact category match: {cat1.title()}")
        return 1.0, reasons
    
    # Partial or related categories
    related_groups = [
        {'electronics', 'gadgets', 'computers', 'phones'},
        {'bags', 'backpacks', 'luggage', 'purses'},
        {'clothing', 'apparel', 'jackets', 'accessories', 'hats'},
        {'keys', 'id cards', 'wallets', 'cards'},
        {'books', 'notebooks', 'stationery'}
    ]
    for group in related_groups:
        if c1 in group and c2 in group:
            reasons.append(f"Related category: {cat1.title()} & {cat2.title()}")
            return 0.7, reasons
            
    return 0.0, reasons


def calculate_visual_tags_score(tags1: List[str], tags2: List[str]) -> Tuple[float, List[str]]:
    """
    Calculate visual similarity using Rekognition AI-detected labels & colors.
    Uses Jaccard similarity and checks for shared distinctive tags.
    """
    reasons = []
    set1 = {t.strip().lower() for t in (tags1 or []) if t}
    set2 = {t.strip().lower() for t in (tags2 or []) if t}

    if not set1 or not set2:
        return 0.0, reasons

    intersection = set1.intersection(set2)
    union = set1.union(set2)
    
    if not union:
        return 0.0, reasons

    jaccard = len(intersection) / len(union)
    
    # Overlap ratio relative to smaller tag set gives accurate visual likeness
    min_len = min(len(set1), len(set2))
    overlap_ratio = len(intersection) / min_len if min_len > 0 else 0.0

    # Combined visual score
    score = (jaccard * 0.3) + (overlap_ratio * 0.7)
    if len(intersection) >= 3 or overlap_ratio >= 0.6:
        score = min(1.0, score + 0.15)

    if intersection:
        matched_tags_str = ", ".join(sorted(list(intersection))[:5])
        reasons.append(f"Matching visual tags: [{matched_tags_str}]")

    return min(1.0, score), reasons


def calculate_location_score(loc1: str, loc2: str) -> Tuple[float, List[str]]:
    """Compare campus locations using zones and token overlap."""
    reasons = []
    if not loc1 or not loc2:
        return 0.0, reasons

    l1_clean, l2_clean = loc1.strip().lower(), loc2.strip().lower()
    if l1_clean == l2_clean:
        reasons.append(f"Same location: {loc1}")
        return 1.0, reasons

    zone1 = get_campus_zone(loc1)
    zone2 = get_campus_zone(loc2)

    if zone1 and zone2 and zone1 == zone2:
        reasons.append(f"Same campus area: {zone1.replace('_', ' ').title()}")
        return 0.85, reasons

    tokens1 = normalize_tokens(loc1)
    tokens2 = normalize_tokens(loc2)
    common = tokens1.intersection(tokens2)
    
    if common:
        score = len(common) / max(len(tokens1), len(tokens2))
        reasons.append(f"Location keywords shared: [{', '.join(common)}]")
        return min(0.75, score * 1.2), reasons

    return 0.1, reasons


def calculate_text_score(title1: str, desc1: str, title2: str, desc2: str) -> Tuple[float, List[str]]:
    """Compare title and description keywords."""
    reasons = []
    tokens_title1 = normalize_tokens(title1)
    tokens_title2 = normalize_tokens(title2)
    tokens_desc1 = normalize_tokens(desc1)
    tokens_desc2 = normalize_tokens(desc2)

    all_tokens1 = tokens_title1.union(tokens_desc1)
    all_tokens2 = tokens_title2.union(tokens_desc2)

    title_overlap = tokens_title1.intersection(tokens_title2)
    all_overlap = all_tokens1.intersection(all_tokens2)

    if not all_tokens1 or not all_tokens2:
        return 0.0, reasons

    score = 0.0
    if title_overlap:
        score += 0.5 * (len(title_overlap) / max(1, min(len(tokens_title1), len(tokens_title2))))
        reasons.append(f"Title keywords match: [{', '.join(title_overlap)}]")

    if all_overlap:
        score += 0.5 * (len(all_overlap) / max(1, min(len(all_tokens1), len(all_tokens2))))

    return min(1.0, score), reasons


def compute_match_score(item_a: Dict[str, Any], item_b: Dict[str, Any]) -> Dict[str, Any]:
    """
    Computes weighted match score between two items.
    item_a and item_b should have opposing types (one 'lost', one 'found').
    Returns {
        'score': float (0.0 to 100.0),
        'breakdown': {
            'category': float,
            'visual': float,
            'location': float,
            'text': float
        },
        'reasons': List[str]
    }
    """
    # 1. Category (30%)
    cat_score, cat_reasons = calculate_category_score(
        item_a.get('category', ''),
        item_b.get('category', '')
    )

    # 2. Visual / Rekognition AI Tags (35%)
    vis_score, vis_reasons = calculate_visual_tags_score(
        item_a.get('ai_tags', []),
        item_b.get('ai_tags', [])
    )

    # 3. Location (20%)
    loc_score, loc_reasons = calculate_location_score(
        item_a.get('location', ''),
        item_b.get('location', '')
    )

    # 4. Text / Keywords (15%)
    txt_score, txt_reasons = calculate_text_score(
        item_a.get('title', ''),
        item_a.get('description', ''),
        item_b.get('title', ''),
        item_b.get('description', '')
    )

    # Weighted final score (0.0 to 1.0 -> 0 to 100%)
    weighted = (
        (cat_score * 0.30) +
        (vis_score * 0.35) +
        (loc_score * 0.20) +
        (txt_score * 0.15)
    )
    final_percentage = round(weighted * 100, 1)

    all_reasons = cat_reasons + vis_reasons + loc_reasons + txt_reasons
    if not all_reasons:
        all_reasons = ["General similarity based on reported details"]

    return {
        'score': final_percentage,
        'breakdown': {
            'category': round(cat_score * 100, 1),
            'visual': round(vis_score * 100, 1),
            'location': round(loc_score * 100, 1),
            'text': round(txt_score * 100, 1)
        },
        'reasons': all_reasons
    }


def find_matches_for_item(target_item: Dict[str, Any], candidate_items: List[Dict[str, Any]], min_score: float = 25.0) -> List[Dict[str, Any]]:
    """
    Find and rank matches for target_item against candidate_items.
    Only items with opposing types (lost vs found) are considered.
    """
    target_type = target_item.get('type', '').lower()
    opposing_type = 'found' if target_type == 'lost' else 'lost'

    ranked = []
    for cand in candidate_items:
        # Ignore self or same type
        if cand.get('id') == target_item.get('id'):
            continue
        if cand.get('type', '').lower() != opposing_type:
            continue
        # Only open or claimed items
        if cand.get('status', 'open').lower() not in ['open', 'claimed']:
            continue

        result = compute_match_score(target_item, cand)
        if result['score'] >= min_score:
            ranked.append({
                'item': cand,
                'score': result['score'],
                'breakdown': result['breakdown'],
                'reasons': result['reasons']
            })

    # Sort descending by score
    ranked.sort(key=lambda x: x['score'], reverse=True)
    return ranked
