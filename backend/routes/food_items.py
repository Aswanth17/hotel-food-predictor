from flask import Blueprint, request, jsonify
from database import get_db_connection

food_items_bp = Blueprint('food_items', __name__)

VALID_UNITS = {'kg', 'litres', 'pieces'}
VALID_CATEGORIES = {'Bakery', 'Main Course', 'Beverage', 'Dairy', 'Breakfast Special', 'Salad', 'Dessert', 'Snacks'}

@food_items_bp.route('', methods=['GET'])
def get_food_items():
    category = request.args.get('category')
    conn = get_db_connection()
    cursor = conn.cursor()

    if category:
        cursor.execute('''
            SELECT 
                fi.*,
                ROUND(AVG(hr.actual_quantity_consumed), 2) as avg_consumption,
                COUNT(hr.id) as record_count
            FROM food_items fi
            LEFT JOIN historical_records hr ON fi.id = hr.food_item_id
            WHERE fi.category = ? AND fi.is_active = 1
            GROUP BY fi.id
            ORDER BY fi.category, fi.name ASC
        ''', (category,))
    else:
        cursor.execute('''
            SELECT 
                fi.*,
                ROUND(AVG(hr.actual_quantity_consumed), 2) as avg_consumption,
                COUNT(hr.id) as record_count
            FROM food_items fi
            LEFT JOIN historical_records hr ON fi.id = hr.food_item_id
            WHERE fi.is_active = 1
            GROUP BY fi.id
            ORDER BY fi.category, fi.name ASC
        ''')

    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "data": items})

@food_items_bp.route('/<int:item_id>', methods=['GET'])
def get_food_item(item_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM food_items WHERE id = ?", (item_id,))
    item = cursor.fetchone()
    conn.close()
    if not item:
        return jsonify({"success": False, "error": "Food item not found"}), 404
    return jsonify({"success": True, "data": dict(item)})

@food_items_bp.route('', methods=['POST'])
def create_food_item():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    category = (data.get('category') or '').strip()
    unit = (data.get('unit') or '').strip().lower()
    default_consumption = data.get('default_consumption_per_guest')
    cost_per_unit = data.get('cost_per_unit', 0.0)
    shelf_life_days = data.get('shelf_life_days', 2)

    if not name or not category or not unit or default_consumption is None:
        return jsonify({"success": False, "error": "Name, category, unit, and default consumption per guest are required"}), 400

    if unit not in VALID_UNITS:
        return jsonify({"success": False, "error": f"Invalid unit '{unit}'. Allowed units: {', '.join(VALID_UNITS)}"}), 400

    try:
        default_consumption = float(default_consumption)
        cost_per_unit = float(cost_per_unit)
        shelf_life_days = int(shelf_life_days)
        if default_consumption <= 0 or cost_per_unit < 0 or shelf_life_days <= 0:
            return jsonify({"success": False, "error": "Values must be positive numbers"}), 400
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Invalid numeric values provided"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM food_items WHERE LOWER(name) = LOWER(?)", (name,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": f"A food item named '{name}' already exists"}), 409

    cursor.execute('''
        INSERT INTO food_items (name, category, unit, default_consumption_per_guest, cost_per_unit, shelf_life_days)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (name, category, unit, default_consumption, cost_per_unit, shelf_life_days))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Food item '{name}' added successfully",
        "data": {"id": new_id, "name": name, "unit": unit}
    }), 201

@food_items_bp.route('/<int:item_id>', methods=['PUT'])
def update_food_item(item_id):
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    category = (data.get('category') or '').strip()
    unit = (data.get('unit') or '').strip().lower()
    default_consumption = data.get('default_consumption_per_guest')
    cost_per_unit = data.get('cost_per_unit', 0.0)
    shelf_life_days = data.get('shelf_life_days', 2)

    if not name or not category or not unit or default_consumption is None:
        return jsonify({"success": False, "error": "Name, category, unit, and default consumption are required"}), 400

    if unit not in VALID_UNITS:
        return jsonify({"success": False, "error": f"Invalid unit '{unit}'. Allowed units: {', '.join(VALID_UNITS)}"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM food_items WHERE id = ?", (item_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": "Food item not found"}), 404

    cursor.execute("SELECT id FROM food_items WHERE LOWER(name) = LOWER(?) AND id != ?", (name, item_id))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": f"Another food item named '{name}' already exists"}), 409

    cursor.execute('''
        UPDATE food_items 
        SET name = ?, category = ?, unit = ?, default_consumption_per_guest = ?, cost_per_unit = ?, shelf_life_days = ?
        WHERE id = ?
    ''', (name, category, unit, float(default_consumption), float(cost_per_unit), int(shelf_life_days), item_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Food item updated successfully"})

@food_items_bp.route('/<int:item_id>', methods=['DELETE'])
def delete_food_item(item_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM food_items WHERE id = ?", (item_id,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({"success": False, "error": "Food item not found"}), 404

    # Soft delete so historical integrity remains intact
    cursor.execute("UPDATE food_items SET is_active = 0 WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Food item '{item['name']}' removed from active catalogue"})
