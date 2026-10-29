from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from database import get_db_connection
from datetime import datetime

events_bp = Blueprint('events', __name__)

def _require_hotel_owns_event(cursor, event_id, hotel_id):
    """Returns event row if owned by hotel_id, else None."""
    return cursor.execute(
        "SELECT * FROM hotel_events WHERE id = ? AND hotel_id = ?",
        (event_id, hotel_id)
    ).fetchone()

@events_bp.route('', methods=['GET'])
@jwt_required()
def get_events():
    hotel_id = int(get_jwt_identity())
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM hotel_events WHERE hotel_id = ? ORDER BY event_date ASC",
        (hotel_id,)
    ).fetchall()
    conn.close()
    return jsonify({"success": True, "events": [dict(r) for r in rows]})

@events_bp.route('', methods=['POST'])
@jwt_required()
def create_event():
    hotel_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    name = (data.get('event_name') or '').strip()
    date = (data.get('event_date') or '').strip()
    end_date = (data.get('event_end_date') or '').strip() or None
    category = data.get('event_category', 'Special Hotel Event')
    description = data.get('description', '')
    expected = data.get('expected_guest_count')

    if not name or not date:
        return jsonify({"success": False, "error": "event_name and event_date are required"}), 400

    valid_cats = ['Normal','Weekend','Public Holiday','Festival','Wedding','Conference','Special Hotel Event']
    if category not in valid_cats:
        return jsonify({"success": False, "error": f"Invalid category. Use one of: {valid_cats}"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO hotel_events (hotel_id, event_name, event_date, event_end_date, event_category, description, expected_guest_count) "
            "VALUES (?,?,?,?,?,?,?)",
            (hotel_id, name, date, end_date, category, description, expected)
        )
        conn.commit()
        eid = cursor.lastrowid
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500
    conn.close()
    return jsonify({"success": True, "event_id": eid, "message": "Event created"}), 201

@events_bp.route('/<int:event_id>', methods=['PUT'])
@jwt_required()
def update_event(event_id):
    hotel_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    conn = get_db_connection()
    cursor = conn.cursor()
    ev = _require_hotel_owns_event(cursor, event_id, hotel_id)
    if not ev:
        conn.close()
        return jsonify({"success": False, "error": "Event not found or access denied"}), 404

    name = data.get('event_name', ev['event_name'])
    date = data.get('event_date', ev['event_date'])
    end_date = data.get('event_end_date', ev['event_end_date'])
    category = data.get('event_category', ev['event_category'])
    description = data.get('description', ev['description'])
    expected = data.get('expected_guest_count', ev['expected_guest_count'])

    cursor.execute(
        "UPDATE hotel_events SET event_name=?, event_date=?, event_end_date=?, event_category=?, description=?, expected_guest_count=? WHERE id=?",
        (name, date, end_date, category, description, expected, event_id)
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Event updated"})

@events_bp.route('/<int:event_id>', methods=['DELETE'])
@jwt_required()
def delete_event(event_id):
    hotel_id = int(get_jwt_identity())
    conn = get_db_connection()
    cursor = conn.cursor()
    ev = _require_hotel_owns_event(cursor, event_id, hotel_id)
    if not ev:
        conn.close()
        return jsonify({"success": False, "error": "Event not found or access denied"}), 404
    cursor.execute("DELETE FROM hotel_events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Event deleted"})

@events_bp.route('/calendar-info', methods=['GET'])
@jwt_required()
def calendar_info():
    """For a given date, return matching hotel events + public holidays."""
    hotel_id = int(get_jwt_identity())
    date_str = request.args.get('date', '')
    if not date_str:
        return jsonify({"success": False, "error": "date parameter required (YYYY-MM-DD)"}), 400

    conn = get_db_connection()
    hotel_evts = conn.execute(
        "SELECT * FROM hotel_events WHERE hotel_id = ? AND event_date <= ? AND (event_end_date IS NULL OR event_end_date >= ?)",
        (hotel_id, date_str, date_str)
    ).fetchall()
    public_hols = conn.execute(
        "SELECT * FROM public_holidays WHERE holiday_date = ?", (date_str,)
    ).fetchall()
    conn.close()

    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
        weekday = dt.weekday()
        is_weekend = weekday >= 5
        day_name = dt.strftime('%A')
        month = dt.month
        if month in [12,1,2]: season = 'Winter'
        elif month in [3,4,5]: season = 'Spring'
        elif month in [6,7,8]: season = 'Summer'
        else: season = 'Autumn'
    except Exception:
        return jsonify({"success": False, "error": "Invalid date format"}), 400

    events_list = [dict(e) for e in hotel_evts]
    holidays_list = [dict(h) for h in public_hols]
    is_holiday = len(holidays_list) > 0 or any(e['event_category'] in ['Public Holiday','Festival'] for e in events_list)
    has_special_event = len(events_list) > 0

    return jsonify({
        "success": True,
        "date": date_str,
        "day_name": day_name,
        "weekday": weekday,
        "is_weekend": is_weekend,
        "season": season,
        "is_holiday_or_event": is_holiday or has_special_event,
        "hotel_events": events_list,
        "public_holidays": holidays_list,
        "calendar_summary": _build_summary(holidays_list, events_list, is_weekend, day_name)
    })

def _build_summary(holidays, events, is_weekend, day_name):
    parts = [day_name]
    if is_weekend:
        parts.append("Weekend")
    for h in holidays:
        parts.append(h['holiday_name'])
    for e in events:
        parts.append(f"{e['event_name']} ({e['event_category']})")
    return " | ".join(parts)
