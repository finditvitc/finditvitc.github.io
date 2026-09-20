import requests
import base64

def test_vision_pipeline():
    with open('testdata/ck1.jpg', 'rb') as f:
        img_bytes = f.read()

    b64_data = f'data:image/jpeg;base64,{base64.b64encode(img_bytes).decode()}'

    print('1. Testing /uploads/presign with imageBase64...')
    res = requests.post('http://localhost:8000/uploads/presign', json={
        'filename': 'calculator_test.jpg',
        'contentType': 'image/jpeg',
        'title': 'Casio Scientific Calculator fx-991EX',
        'category': 'Electronics',
        'imageBase64': b64_data
    })
    print('Uploads/presign status:', res.status_code)
    data = res.json()
    print('Presign response keys:', list(data.keys()))
    print('Presign tags:', data.get('ai_tags'))

    print('\n2. Testing /items POST (creating a lost report)...')
    item_res = requests.post('http://localhost:8000/items', json={
        'title': 'Casio Scientific Calculator fx-991EX',
        'type': 'lost',
        'category': 'Electronics',
        'location': 'Library',
        'description': 'Black Casio fx-991EX calculator left on 2nd floor desk',
        'photoUrl': data.get('downloadUrl') or data.get('url'),
        'ai_tags': data.get('ai_tags', ['Calculator', 'Electronics']),
        'detected_labels': data.get('detected_labels', []),
        'contactInfo': 'student@campus.edu'
    })
    print('Items POST status:', item_res.status_code)
    created_item = item_res.json().get('item', {})
    print('Created Item ID:', created_item.get('id'))
    print('Created Item Photo URL:', str(created_item.get('photoUrl'))[:60])
    print('Created Item AI Tags:', created_item.get('ai_tags'))

    print('\n3. Testing /items GET (feed query)...')
    feed_res = requests.get('http://localhost:8000/items')
    feed_items = feed_res.json().get('items', [])
    print(f'Total items in feed: {len(feed_items)}')
    for item in feed_items:
        p_url = str(item.get('photoUrl', ''))[:60]
        print(f" - [{item.get('type')}] {item.get('title')}: photoUrl={p_url}..., tags={item.get('ai_tags')}")

if __name__ == '__main__':
    test_vision_pipeline()
