import urllib.request
import json
import random
import sys

BASE = 'http://127.0.0.1:5000/api'

def post(url, data, token=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type':'application/json'})
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def get(url, token=None):
    req = urllib.request.Request(url)
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def delete(url, token=None):
    req = urllib.request.Request(url, method='DELETE')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

passed = 0
failed = 0

def test(name, condition, detail=''):
    global passed, failed
    if condition:
        print('  PASS: ' + name)
        passed += 1
    else:
        print('  FAIL: ' + name + ' -- ' + str(detail))
        failed += 1

print('=== TEST 1: Login demo Hotel A ===')
res = post(BASE + '/auth/login', {'email': 'grand@hotel.com', 'password': 'password123'})
test('Hotel A login succeeds', res.get('success'), res)
token_a   = res.get('access_token', '')
hotel_a_id = res.get('hotel_id', 0)
print('  hotel_id=' + str(hotel_a_id) + ' name=' + str(res.get('hotel_name')))

print()
print('=== TEST 2: Login demo Hotel B ===')
res = post(BASE + '/auth/login', {'email': 'royalpalm@hotel.com', 'password': 'password123'})
test('Hotel B login succeeds', res.get('success'), res)
token_b    = res.get('access_token', '')
hotel_b_id = res.get('hotel_id', 0)
print('  hotel_id=' + str(hotel_b_id))

print()
print('=== TEST 3: Invalid password rejected ===')
res = post(BASE + '/auth/login', {'email': 'grand@hotel.com', 'password': 'wrongpassword'})
test('Wrong password rejected', not res.get('success'), res)

print()
print('=== TEST 4: Protected endpoint without token ===')
res = get(BASE + '/events')
test('Events endpoint rejects unauthenticated', not res.get('success'), res)

print()
print('=== TEST 5: Hotel A creates private event ===')
res = post(BASE + '/events', {
    'event_name': 'Hotel A Secret Gala',
    'event_date': '2027-03-15',
    'event_category': 'Wedding'
}, token_a)
test('Hotel A creates event', res.get('success'), res)
event_id_a = res.get('event_id', -1)
print('  event_id=' + str(event_id_a))

print()
print('=== TEST 6: Hotel A can see its own event ===')
res = get(BASE + '/events', token_a)
ids = [e['id'] for e in res.get('events', [])]
test('Hotel A sees its event', event_id_a in ids, 'ids=' + str(ids))

print()
print('=== TEST 7: Hotel B CANNOT see Hotel A events ===')
res = get(BASE + '/events', token_b)
b_ids = [e['id'] for e in res.get('events', [])]
test('Hotel B cannot see Hotel A event', event_id_a not in b_ids, 'b_ids=' + str(b_ids))

print()
print('=== TEST 8: Hotel B CANNOT delete Hotel A event ===')
code, data = delete(BASE + '/events/' + str(event_id_a), token_b)
test('Hotel B gets 404 deleting Hotel A event', code == 404, 'code=' + str(code))

print()
print('=== TEST 9: /auth/me returns correct hotel ===')
res = get(BASE + '/auth/me', token_a)
test('/me returns correct hotel_id', res.get('success') and res.get('hotel', {}).get('id') == hotel_a_id, res)

print()
print('=== TEST 10: Calendar info for Diwali 2026-11-08 ===')
res = get(BASE + '/events/calendar-info?date=2026-11-08', token_a)
test('Calendar info returns success', res.get('success'), res)
if res.get('success'):
    print('  Summary: ' + str(res.get('calendar_summary')))
    print('  is_holiday_or_event=' + str(res.get('is_holiday_or_event')) + '  season=' + str(res.get('season')))

print()
print('=== TEST 11: Register brand new hotel ===')
suffix = random.randint(10000, 99999)
res = post(BASE + '/auth/register', {
    'hotel_name': 'Test New Hotel ' + str(suffix),
    'city': 'Test City',
    'email': 'newhotel' + str(suffix) + '@test.com',
    'password': 'securepass123',
    'confirm_password': 'securepass123',
    'total_rooms': 80,
    'star_rating': 3,
    'dining_capacity': 100
})
test('New hotel registration succeeds', res.get('success') and 'access_token' in res, res)
token_new = res.get('access_token', '')

print()
print('=== TEST 12: Newly registered hotel sees no events ===')
res = get(BASE + '/events', token_new)
evts = res.get('events', [])
test('New hotel has empty events list', len(evts) == 0, 'events=' + str(evts))

print()
print('=== TEST 13: Health endpoint shows XGBoost status ===')
res = get(BASE + '/health')
test('Health endpoint returns healthy', res.get('status') == 'healthy', res)
print('  XGBoost available: ' + str(res.get('models', {}).get('xgboost_available')))

print()
print('=== TEST 14: Duplicate email registration rejected ===')
res = post(BASE + '/auth/register', {
    'hotel_name': 'Another Hotel XYZ',
    'city': 'City',
    'email': 'grand@hotel.com',
    'password': 'pass123',
    'confirm_password': 'pass123',
    'total_rooms': 50, 'star_rating': 3, 'dining_capacity': 80
})
test('Duplicate email rejected', not res.get('success'), res)

print()
print('======================================')
print('RESULTS: ' + str(passed) + ' passed, ' + str(failed) + ' failed')
if failed == 0:
    print('ALL TESTS PASSED!')
else:
    print('SOME TESTS FAILED - see above')
    sys.exit(1)
