from flask import Blueprint, request, jsonify
from database import get_db_connection

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('', methods=['GET'])
def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value, description FROM settings")
    rows = cursor.fetchall()
    conn.close()

    settings_dict = {row['key']: row['value'] for row in rows}
    settings_metadata = [dict(row) for row in rows]

    return jsonify({
        "success": True,
        "data": settings_dict,
        "details": settings_metadata
    })

@settings_bp.route('', methods=['PUT'])
def update_settings():
    data = request.get_json() or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    updated = []
    for key, val in data.items():
        cursor.execute("SELECT key FROM settings WHERE key = ?", (key,))
        if cursor.fetchone():
            cursor.execute("UPDATE settings SET value = ? WHERE key = ?", (str(val), key))
            updated.append(key)
        else:
            cursor.execute("INSERT INTO settings (key, value, description) VALUES (?, ?, 'Custom user setting')", (key, str(val)))
            updated.append(key)

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Updated settings: {', '.join(updated)}"})
