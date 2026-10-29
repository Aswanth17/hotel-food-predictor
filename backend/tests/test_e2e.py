"""
End-to-end smoke test: login → prediction → model comparison
"""
import urllib.request
import json

BASE = 'http://127.0.0.1:5000/api'

def post(url, data, token=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode(),
                                  headers={'Content-Type': 'application/json'})
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def get(url, token=None):
    req = urllib.request.Request(url)
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

passed = 0
failed = 0

def test(name, cond, detail=''):
    global passed, failed
    if cond:
        print(f'  PASS: {name}')
        passed += 1
    else:
        print(f'  FAIL: {name} -- {detail}')
        failed += 1

# ── Login ────────────────────────────────────────────────────────────────
print('=== E2E Test 1: Login as Grand Horizon Palace ===')
code, res = post(BASE + '/auth/login', {'email': 'grand@hotel.com', 'password': 'password123'})
test('Login succeeds', res.get('success'), res)
token = res.get('access_token', '')
hotel_id = res.get('hotel_id')
print(f'  hotel_id={hotel_id}  hotel_name={res.get("hotel_name")}')

# ── Food items ───────────────────────────────────────────────────────────
print('\n=== E2E Test 2: Get food items ===')
code, res = get(BASE + '/food-items')
test('Food items endpoint works', code == 200 and len(res.get('data', [])) > 0, res)
food_item_id = res['data'][0]['id'] if res.get('data') else 1
food_name = res['data'][0]['name'] if res.get('data') else 'Unknown'
print(f'  First food item: id={food_item_id}  name={food_name}')

# ── Calendar info for Diwali ─────────────────────────────────────────────
print('\n=== E2E Test 3: Calendar info for Diwali 2026-11-08 ===')
code, res = get(BASE + '/events/calendar-info?date=2026-11-08', token)
test('Calendar info for holiday', res.get('success') and res.get('is_holiday_or_event'), res)
print(f'  {res.get("calendar_summary")}')

# ── Prediction ────────────────────────────────────────────────────────────
print('\n=== E2E Test 4: Make a prediction (hotel 1, Diwali date) ===')
code, res = post(BASE + '/predictions', {
    'hotel_id': hotel_id,
    'prediction_date': '2026-11-08',
    'meal_type': 'Dinner',
    'food_item_id': food_item_id,
    'safety_buffer_percent': 7.0
}, token)
test('Prediction succeeds', res.get('success'), res)
if res.get('success'):
    d = res.get('data', res)
    print(f'  Guest Count: {d.get("predicted_guest_count")}')
    print(f'  Food Qty: {d.get("recommended_food_quantity")} {d.get("unit")}')
    print(f'  Method: {d.get("prediction_method")}')

# ── Model comparison ──────────────────────────────────────────────────────
print('\n=== E2E Test 5: Model comparison endpoint ===')
code, res = get(BASE + '/models/comparison')
test('Model comparison returns data', code == 200 and 'comparison' in res, res)
if 'comparison' in res:
    for m in res['comparison']:
        print(f'  {m.get("algorithm_key","?")} | {m.get("model_name","?")} | R2={m.get("r2_score","?")} | RMSE={m.get("rmse","?")} | MAPE={m.get("mape","?")}')
    if res.get('best_models'):
        print(f'  Best Guest Model: {res["best_models"].get("guest","?")}')
        print(f'  Best Food Model:  {res["best_models"].get("food","?")}')

# ── Prediction history isolation ──────────────────────────────────────────
print('\n=== E2E Test 6: Hotel B prediction history isolation ===')
code_b, res_b = post(BASE + '/auth/login', {'email': 'royalpalm@hotel.com', 'password': 'password123'})
token_b = res_b.get('access_token', '')
code, res = get(BASE + '/predictions?hotel_id=' + str(hotel_id), token_b)
test('Hotel B history endpoint works', code == 200, res)
# Hotel B should not see Hotel A predictions
if code == 200:
    hotel_a_preds = [p for p in res.get('predictions', []) if p.get('hotel_id') == hotel_id]
    test('Hotel B cannot see Hotel A predictions', len(hotel_a_preds) == 0,
         f'{len(hotel_a_preds)} Hotel A predictions leaked!')

print(f'\n{"="*40}')
print(f'RESULTS: {passed} passed, {failed} failed')
if failed == 0:
    print('ALL E2E TESTS PASSED!')
else:
    print('Some tests failed -- see above.')
