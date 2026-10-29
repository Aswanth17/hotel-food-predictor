import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt_identity, get_jwt
)
from database import get_db_connection
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

def get_current_hotel():
    """Helper: return hotel_id (int) from JWT identity (stored as string)."""
    identity = get_jwt_identity()
    return int(identity)  # JWT stores as string; convert back to int


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    hotel_name = (data.get('hotel_name') or '').strip()
    city = (data.get('city') or 'Unknown').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    confirm = data.get('confirm_password', '')
    total_rooms = int(data.get('total_rooms', 100))
    star_rating = int(data.get('star_rating', 4))
    dining_capacity = int(data.get('dining_capacity', 150))

    if not hotel_name:
        return jsonify({"success": False, "error": "Hotel name is required"}), 400
    if not email or '@' not in email:
        return jsonify({"success": False, "error": "Valid email is required"}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400
    if password != confirm:
        return jsonify({"success": False, "error": "Passwords do not match"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check duplicate email
    if cursor.execute("SELECT id FROM hotel_accounts WHERE email = ?", (email,)).fetchone():
        conn.close()
        return jsonify({"success": False, "error": "An account with this email already exists"}), 409

    # Check duplicate hotel name
    if cursor.execute("SELECT id FROM hotels WHERE LOWER(name) = LOWER(?)", (hotel_name,)).fetchone():
        conn.close()
        return jsonify({"success": False, "error": "A hotel with this name already exists"}), 409

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        cursor.execute(
            "INSERT INTO hotels (name, city, total_rooms, star_rating, dining_capacity) VALUES (?,?,?,?,?)",
            (hotel_name, city, total_rooms, star_rating, dining_capacity)
        )
        hotel_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO hotel_accounts (hotel_id, email, password_hash) VALUES (?,?,?)",
            (hotel_id, email, pw_hash)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"success": False, "error": f"Registration failed: {str(e)}"}), 500

    conn.close()
    token = create_access_token(identity=str(hotel_id))
    return jsonify({
        "success": True,
        "message": "Hotel registered successfully",
        "hotel_id": hotel_id,
        "hotel_name": hotel_name,
        "access_token": token
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Check if it's an Admin account
    admin_acct = cursor.execute(
        "SELECT * FROM admin_accounts WHERE email = ?", (email,)
    ).fetchone()

    if admin_acct and bcrypt.checkpw(password.encode(), admin_acct['password_hash'].encode()):
        conn.close()
        token = create_access_token(identity=f"admin:{admin_acct['id']}")
        return jsonify({
            "success": True,
            "access_token": token,
            "role": "admin",
            "hotel_id": 0,
            "hotel_name": "System Administrator",
            "email": email,
            "name": admin_acct['name'],
            "city": "HQ",
            "star_rating": 5,
            "dining_capacity": 0,
            "total_rooms": 0
        })

    # 2. Check if it's a Hotel account
    acct = cursor.execute(
        "SELECT ha.*, h.name as hotel_name, h.city, h.star_rating, h.dining_capacity, h.total_rooms "
        "FROM hotel_accounts ha JOIN hotels h ON ha.hotel_id = h.id WHERE ha.email = ?",
        (email,)
    ).fetchone()

    if not acct:
        conn.close()
        return jsonify({"success": False, "error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode(), acct['password_hash'].encode()):
        conn.close()
        return jsonify({"success": False, "error": "Invalid email or password"}), 401

    if not acct['is_active']:
        conn.close()
        return jsonify({"success": False, "error": "Account is deactivated. Contact support."}), 403

    # Update last login
    cursor.execute("UPDATE hotel_accounts SET last_login = ? WHERE id = ?",
                   (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), acct['id']))
    conn.commit()
    conn.close()

    hotel_id = acct['hotel_id']
    token = create_access_token(identity=str(hotel_id))
    return jsonify({
        "success": True,
        "access_token": token,
        "role": "hotel",
        "hotel_id": hotel_id,
        "hotel_name": acct['hotel_name'],
        "city": acct['city'],
        "star_rating": acct['star_rating'],
        "dining_capacity": acct['dining_capacity'],
        "total_rooms": acct['total_rooms'],
        "email": email
    })


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    identity = str(get_jwt_identity())
    conn = get_db_connection()
    if identity.startswith('admin:'):
        admin_id = int(identity.split(':')[1])
        row = conn.execute("SELECT id, email, name, created_at FROM admin_accounts WHERE id = ?", (admin_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({"success": False, "error": "Admin not found"}), 404
        return jsonify({
            "success": True,
            "role": "admin",
            "hotel": {
                "hotel_id": 0,
                "hotel_name": "System Administrator",
                "email": row["email"],
                "role": "admin",
                "city": "HQ",
                "star_rating": 5,
                "dining_capacity": 0,
                "total_rooms": 0
            }
        })

    hotel_id = int(identity)
    row = conn.execute(
        "SELECT h.*, ha.email, ha.last_login FROM hotels h "
        "JOIN hotel_accounts ha ON ha.hotel_id = h.id WHERE h.id = ?",
        (hotel_id,)
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"success": False, "error": "Hotel not found"}), 404
    h_dict = dict(row)
    h_dict['role'] = 'hotel'
    return jsonify({"success": True, "role": "hotel", "hotel": h_dict})


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # JWT is stateless; client just discards the token
    return jsonify({"success": True, "message": "Logged out successfully"})
