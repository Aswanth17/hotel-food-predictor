from flask import Blueprint, request, jsonify
from database import get_db_connection

hotels_bp = Blueprint('hotels', __name__)

@hotels_bp.route('', methods=['GET'])
def get_hotels():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            h.id,
            h.name,
            h.city,
            h.total_rooms,
            h.star_rating,
            h.dining_capacity,
            h.contact_email,
            h.contact_phone,
            h.created_at,
            COUNT(hr.id) as historical_record_count
        FROM hotels h
        LEFT JOIN historical_records hr ON h.id = hr.hotel_id
        GROUP BY h.id
        ORDER BY h.name ASC
    ''')
    hotels = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "data": hotels})

@hotels_bp.route('/<int:hotel_id>', methods=['GET'])
def get_hotel(hotel_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM hotels WHERE id = ?", (hotel_id,))
    hotel = cursor.fetchone()
    conn.close()
    if not hotel:
        return jsonify({"success": False, "error": "Hotel not found"}), 404
    return jsonify({"success": True, "data": dict(hotel)})

@hotels_bp.route('', methods=['POST'])
def create_hotel():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    city = (data.get('city') or '').strip()
    total_rooms = data.get('total_rooms', 100)
    star_rating = data.get('star_rating', 4)
    dining_capacity = data.get('dining_capacity', 150)
    contact_email = (data.get('contact_email') or '').strip()
    contact_phone = (data.get('contact_phone') or '').strip()

    if not name:
        return jsonify({"success": False, "error": "Hotel name is required"}), 400
    if not city:
        return jsonify({"success": False, "error": "City is required"}), 400

    try:
        total_rooms = int(total_rooms)
        dining_capacity = int(dining_capacity)
        star_rating = int(star_rating)
        if total_rooms <= 0 or dining_capacity <= 0 or star_rating < 1 or star_rating > 5:
            return jsonify({"success": False, "error": "Invalid rooms, capacity, or star rating (1-5)"}), 400
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Rooms, capacity, and star rating must be valid integers"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check duplicate hotel name
    cursor.execute("SELECT id FROM hotels WHERE LOWER(name) = LOWER(?)", (name,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": f"A hotel named '{name}' already exists"}), 409

    cursor.execute('''
        INSERT INTO hotels (name, city, total_rooms, star_rating, dining_capacity, contact_email, contact_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (name, city, total_rooms, star_rating, dining_capacity, contact_email, contact_phone))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Hotel '{name}' added successfully",
        "data": {"id": new_id, "name": name, "city": city}
    }), 201

@hotels_bp.route('/<int:hotel_id>/capacity', methods=['PUT'])
def upgrade_capacity(hotel_id):
    data = request.get_json() or {}
    dining_capacity = data.get('dining_capacity')
    total_rooms = data.get('total_rooms')

    if dining_capacity is None and total_rooms is None:
        return jsonify({"success": False, "error": "dining_capacity or total_rooms is required"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, dining_capacity, total_rooms FROM hotels WHERE id = ?", (hotel_id,))
        hotel = cursor.fetchone()
        if not hotel:
            conn.close()
            return jsonify({"success": False, "error": "Hotel not found"}), 404

        new_dining = int(dining_capacity) if dining_capacity is not None else hotel['dining_capacity']
        new_rooms = int(total_rooms) if total_rooms is not None else hotel['total_rooms']

        if new_dining <= 0 or new_rooms <= 0:
            conn.close()
            return jsonify({"success": False, "error": "Capacity and rooms must be greater than 0"}), 400

        cursor.execute(
            "UPDATE hotels SET dining_capacity = ?, total_rooms = ? WHERE id = ?",
            (new_dining, new_rooms, hotel_id)
        )
        conn.commit()
        conn.close()
        return jsonify({
            "success": True,
            "message": f"Successfully updated capacity to {new_dining} dining seats and {new_rooms} rooms",
            "data": {
                "hotel_id": hotel_id,
                "dining_capacity": new_dining,
                "total_rooms": new_rooms
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@hotels_bp.route('/<int:hotel_id>', methods=['PUT'])
def update_hotel(hotel_id):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    city = (data.get('city') or '').strip()
    total_rooms = data.get('total_rooms')
    star_rating = data.get('star_rating')
    dining_capacity = data.get('dining_capacity')
    contact_email = (data.get('contact_email') or '').strip()
    contact_phone = (data.get('contact_phone') or '').strip()

    if not name or not city:
        return jsonify({"success": False, "error": "Hotel name and city are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM hotels WHERE id = ?", (hotel_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": "Hotel not found"}), 404

    # Check for name collision with other hotel
    cursor.execute("SELECT id FROM hotels WHERE LOWER(name) = LOWER(?) AND id != ?", (name, hotel_id))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": f"Another hotel with name '{name}' already exists"}), 409

    cursor.execute('''
        UPDATE hotels 
        SET name = ?, city = ?, total_rooms = ?, star_rating = ?, dining_capacity = ?, contact_email = ?, contact_phone = ?
        WHERE id = ?
    ''', (name, city, total_rooms, star_rating, dining_capacity, contact_email, contact_phone, hotel_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Hotel updated successfully"})

@hotels_bp.route('/<int:hotel_id>', methods=['DELETE'])
def delete_hotel(hotel_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM hotels WHERE id = ?", (hotel_id,))
    hotel = cursor.fetchone()
    if not hotel:
        conn.close()
        return jsonify({"success": False, "error": "Hotel not found"}), 404

    # Delete cascade handled by foreign keys
    cursor.execute("DELETE FROM hotels WHERE id = ?", (hotel_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Hotel '{hotel['name']}' deleted successfully"})
