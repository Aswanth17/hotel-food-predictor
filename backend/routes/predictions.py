from flask import Blueprint, request, jsonify
from database import get_db_connection
from models.predictor import predict_provision_requirement

predictions_bp = Blueprint('predictions', __name__)

@predictions_bp.route('', methods=['POST'])
def make_prediction():
    data = request.get_json() or {}
    hotel_id = data.get('hotel_id')
    date_str = data.get('date') or data.get('prediction_date')
    meal_type = data.get('meal_type')
    food_item_id = data.get('food_item_id')
    safety_buffer = data.get('safety_buffer_percent')
    is_holiday_or_event = data.get('is_holiday_or_event', 0)

    if not hotel_id or not date_str or not meal_type or not food_item_id:
        return jsonify({
            "success": False,
            "error": "Missing required fields: hotel_id, date (YYYY-MM-DD), meal_type, and food_item_id are required."
        }), 400

    if meal_type not in ['Breakfast', 'Lunch', 'Dinner']:
        return jsonify({
            "success": False,
            "error": "Invalid meal_type. Must be 'Breakfast', 'Lunch', or 'Dinner'."
        }), 400

    try:
        hotel_id = int(hotel_id)
        food_item_id = int(food_item_id)
        if safety_buffer is not None:
            safety_buffer = float(safety_buffer)
    except ValueError:
        return jsonify({"success": False, "error": "Invalid identifier or buffer value"}), 400

    try:
        result = predict_provision_requirement(
            hotel_id=hotel_id,
            date_str=date_str,
            meal_type=meal_type,
            food_item_id=food_item_id,
            safety_buffer_percent=safety_buffer,
            is_holiday_or_event=is_holiday_or_event
        )
        return jsonify({"success": True, "data": result})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Prediction failed: {str(e)}"}), 500

@predictions_bp.route('/batch', methods=['POST'])
def make_batch_prediction():
    """Predicts food quantities for multiple food items for a single hotel/date/meal service."""
    data = request.get_json() or {}
    hotel_id = data.get('hotel_id')
    date_str = data.get('date')
    meal_type = data.get('meal_type')
    food_item_ids = data.get('food_item_ids', [])
    safety_buffer = data.get('safety_buffer_percent')
    is_holiday_or_event = data.get('is_holiday_or_event', 0)

    if not hotel_id or not date_str or not meal_type or not food_item_ids:
        return jsonify({"success": False, "error": "hotel_id, date, meal_type, and food_item_ids list are required."}), 400

    results = []
    errors = []

    for item_id in food_item_ids:
        try:
            res = predict_provision_requirement(
                hotel_id=int(hotel_id),
                date_str=date_str,
                meal_type=meal_type,
                food_item_id=int(item_id),
                safety_buffer_percent=float(safety_buffer) if safety_buffer is not None else None,
                is_holiday_or_event=is_holiday_or_event
            )
            results.append(res)
        except Exception as e:
            errors.append({"food_item_id": item_id, "error": str(e)})

    return jsonify({
        "success": True,
        "data": results,
        "errors": errors if errors else None
    })

@predictions_bp.route('', methods=['GET'])
def get_prediction_history():
    hotel_id = request.args.get('hotel_id')
    food_item_id = request.args.get('food_item_id')
    meal_type = request.args.get('meal_type')
    search = (request.args.get('search') or '').strip()
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    page = max(1, int(request.args.get('page', 1)))
    limit = max(1, min(100, int(request.args.get('limit', 20))))
    offset = (page - 1) * limit

    conn = get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT 
            p.id,
            p.prediction_date,
            p.meal_type,
            h.id as hotel_id,
            h.name as hotel_name,
            fi.id as food_item_id,
            fi.name as food_item_name,
            fi.category as food_category,
            p.predicted_guest_count,
            p.base_estimated_quantity,
            p.safety_buffer_percent,
            p.recommended_food_quantity,
            p.unit,
            p.prediction_method,
            p.notes,
            p.created_at
        FROM predictions p
        JOIN hotels h ON p.hotel_id = h.id
        JOIN food_items fi ON p.food_item_id = fi.id
        WHERE 1=1
    '''
    params = []

    if hotel_id:
        query += " AND p.hotel_id = ?"
        params.append(hotel_id)

    if food_item_id:
        query += " AND p.food_item_id = ?"
        params.append(food_item_id)

    if meal_type:
        query += " AND p.meal_type = ?"
        params.append(meal_type)

    if from_date:
        query += " AND p.prediction_date >= ?"
        params.append(from_date)

    if to_date:
        query += " AND p.prediction_date <= ?"
        params.append(to_date)

    if search:
        query += " AND (h.name LIKE ? OR fi.name LIKE ? OR fi.category LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    # Count total
    count_query = f"SELECT COUNT(*) FROM ({query})"
    cursor.execute(count_query, params)
    total_records = cursor.fetchone()[0]

    # Order and paginate
    query += " ORDER BY p.id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        "success": True,
        "data": records,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_records": total_records,
            "total_pages": (total_records + limit - 1) // limit if total_records > 0 else 1
        }
    })

@predictions_bp.route('/<int:pred_id>', methods=['DELETE'])
def delete_prediction(pred_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM predictions WHERE id = ?", (pred_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "error": "Prediction record not found"}), 404

    cursor.execute("DELETE FROM predictions WHERE id = ?", (pred_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Prediction record deleted successfully"})
