"""
Unit Tests for CampusFind AI Matching Engine
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'lambda')))

from matching_engine import (
    compute_match_score,
    find_matches_for_item,
    calculate_category_score,
    calculate_visual_tags_score,
    calculate_location_score,
    calculate_text_score
)

def test_category_matching():
    score, reasons = calculate_category_score('Electronics', 'Electronics')
    assert score == 1.0
    assert len(reasons) > 0

    score_rel, reasons_rel = calculate_category_score('electronics', 'gadgets')
    assert score_rel == 0.7

    score_diff, _ = calculate_category_score('Clothing', 'Electronics')
    assert score_diff == 0.0

def test_visual_tags_matching():
    tags1 = ['Backpack', 'Bag', 'Blue', 'Luggage', 'Canvas']
    tags2 = ['Backpack', 'Bag', 'Blue', 'Zipper']

    score, reasons = calculate_visual_tags_score(tags1, tags2)
    assert score > 0.6
    assert any('backpack' in r.lower() or 'blue' in r.lower() for r in reasons)

def test_location_zone_matching():
    score1, reasons1 = calculate_location_score('Main Library 2nd Floor', 'Science Library Stacks')
    # Both belong to 'library' zone
    assert score1 >= 0.85

    score2, reasons2 = calculate_location_score('Dining Commons', 'Athletics Gym')
    assert score2 <= 0.1

def test_high_confidence_match():
    lost_item = {
        'id': 'lost-101',
        'type': 'lost',
        'title': 'Blue North Face Backpack',
        'category': 'Bags & Backpacks',
        'location': 'Library 2nd Floor Study Room',
        'description': 'Navy blue backpack containing notebooks and a hydroflask',
        'ai_tags': ['Backpack', 'Bag', 'Blue', 'Luggage', 'Strap']
    }

    found_item = {
        'id': 'found-202',
        'type': 'found',
        'title': 'Found Blue Backpack at Library',
        'category': 'Bags & Backpacks',
        'location': 'Main Library front desk',
        'description': 'Blue canvas backpack handed in by a student near study desks',
        'ai_tags': ['Backpack', 'Bag', 'Blue', 'Canvas', 'Pocket'],
        'status': 'open'
    }

    res = compute_match_score(lost_item, found_item)
    assert res['score'] >= 75.0
    assert len(res['reasons']) >= 3
    assert res['breakdown']['category'] == 100.0

def test_find_matches_for_item_filters_opposing_type():
    target_lost = {
        'id': 'item-1',
        'type': 'lost',
        'title': 'AirPods Pro Case',
        'category': 'Electronics',
        'location': 'Student Center Lounge',
        'description': 'White case with small scratch on bottom',
        'ai_tags': ['Headphones', 'Earphone', 'Audio', 'Gadget', 'White']
    }

    candidates = [
        # Candidate 1: Opposing type (found), strong match
        {
            'id': 'item-2',
            'type': 'found',
            'title': 'Found White Earbuds Case',
            'category': 'Electronics',
            'location': 'Student Center Food Court',
            'description': 'White airpod case found on booth table',
            'ai_tags': ['Headphones', 'Earphone', 'Audio', 'White'],
            'status': 'open'
        },
        # Candidate 2: Same type (lost) -> should be ignored!
        {
            'id': 'item-3',
            'type': 'lost',
            'title': 'Lost AirPods',
            'category': 'Electronics',
            'location': 'Student Center',
            'status': 'open'
        },
        # Candidate 3: Opposing type (found), but resolved -> should be ignored!
        {
            'id': 'item-4',
            'type': 'found',
            'title': 'Found AirPods',
            'category': 'Electronics',
            'location': 'Student Center',
            'status': 'resolved'
        }
    ]

    matches = find_matches_for_item(target_lost, candidates)
    assert len(matches) == 1
    assert matches[0]['item']['id'] == 'item-2'
    assert matches[0]['score'] > 75.0
