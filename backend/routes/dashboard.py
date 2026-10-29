from flask import Blueprint, jsonify, request
from database import get_db_connection

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
def get_dashboard_stats():
    hotel_id = request.args.get('hotel_id')
    try:
        hotel_id = int(hotel_id) if hotel_id else None
    except ValueError:
        hotel_id = None

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Total counts
        cursor.execute("SELECT COUNT(*) FROM hotels")
        total_hotels = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM food_items WHERE is_active = 1")
        total_food_items = cursor.fetchone()[0]

        if hotel_id:
            cursor.execute("SELECT COUNT(*) FROM historical_records WHERE hotel_id = ?", (hotel_id,))
            total_historical_records = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM predictions WHERE hotel_id = ?", (hotel_id,))
            total_predictions = cursor.fetchone()[0]

            # Recent predictions for this hotel
            cursor.execute('''
                SELECT 
                    p.id,
                    p.prediction_date,
                    p.meal_type,
                    h.name as hotel_name,
                    fi.name as food_item_name,
                    fi.category as food_category,
                    p.predicted_guest_count,
                    p.base_estimated_quantity,
                    p.safety_buffer_percent,
                    p.recommended_food_quantity,
                    p.unit,
                    p.prediction_method,
                    p.created_at
                FROM predictions p
                JOIN hotels h ON p.hotel_id = h.id
                JOIN food_items fi ON p.food_item_id = fi.id
                WHERE p.hotel_id = ?
                ORDER BY p.id DESC
                LIMIT 6
            ''', (hotel_id,))
            recent_predictions = [dict(row) for row in cursor.fetchall()]

            # Guest count trends for this hotel
            cursor.execute('''
                SELECT 
                    record_date,
                    ROUND(AVG(actual_guest_count), 1) as avg_guest_count,
                    MAX(actual_guest_count) as max_guest_count,
                    MIN(actual_guest_count) as min_guest_count
                FROM (
                    SELECT DISTINCT hotel_id, record_date, meal_type, actual_guest_count
                    FROM historical_records
                    WHERE hotel_id = ?
                )
                GROUP BY record_date
                ORDER BY record_date DESC
                LIMIT 14
            ''', (hotel_id,))
            guest_trends = [dict(row) for row in reversed(cursor.fetchall())]

            # Meal session distribution for this hotel
            cursor.execute('''
                SELECT 
                    meal_type,
                    ROUND(AVG(actual_guest_count), 1) as avg_guests,
                    COUNT(DISTINCT record_date) as service_days
                FROM (
                    SELECT DISTINCT hotel_id, record_date, meal_type, actual_guest_count
                    FROM historical_records
                    WHERE hotel_id = ?
                )
                GROUP BY meal_type
            ''', (hotel_id,))
            meal_distribution = [dict(row) for row in cursor.fetchall()]

            # Top 5 food items for this hotel
            cursor.execute('''
                SELECT 
                    fi.name,
                    fi.category,
                    fi.unit,
                    ROUND(SUM(hr.actual_quantity_consumed), 1) as total_consumed,
                    ROUND(AVG(hr.actual_quantity_consumed), 1) as avg_per_service
                FROM historical_records hr
                JOIN food_items fi ON hr.food_item_id = fi.id
                WHERE hr.hotel_id = ?
                GROUP BY fi.id
                ORDER BY total_consumed DESC
                LIMIT 5
            ''', (hotel_id,))
            top_food_items = [dict(row) for row in cursor.fetchall()]

        else:
            # Global / Admin view
            cursor.execute("SELECT COUNT(*) FROM historical_records")
            total_historical_records = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM predictions")
            total_predictions = cursor.fetchone()[0]

            cursor.execute('''
                SELECT 
                    p.id,
                    p.prediction_date,
                    p.meal_type,
                    h.name as hotel_name,
                    fi.name as food_item_name,
                    fi.category as food_category,
                    p.predicted_guest_count,
                    p.base_estimated_quantity,
                    p.safety_buffer_percent,
                    p.recommended_food_quantity,
                    p.unit,
                    p.prediction_method,
                    p.created_at
                FROM predictions p
                JOIN hotels h ON p.hotel_id = h.id
                JOIN food_items fi ON p.food_item_id = fi.id
                ORDER BY p.id DESC
                LIMIT 6
            ''')
            recent_predictions = [dict(row) for row in cursor.fetchall()]

            cursor.execute('''
                SELECT 
                    record_date,
                    ROUND(AVG(actual_guest_count), 1) as avg_guest_count,
                    MAX(actual_guest_count) as max_guest_count,
                    MIN(actual_guest_count) as min_guest_count
                FROM (
                    SELECT DISTINCT hotel_id, record_date, meal_type, actual_guest_count
                    FROM historical_records
                )
                GROUP BY record_date
                ORDER BY record_date DESC
                LIMIT 14
            ''')
            guest_trends = [dict(row) for row in reversed(cursor.fetchall())]

            cursor.execute('''
                SELECT 
                    meal_type,
                    ROUND(AVG(actual_guest_count), 1) as avg_guests,
                    COUNT(DISTINCT record_date) as service_days
                FROM (
                    SELECT DISTINCT hotel_id, record_date, meal_type, actual_guest_count
                    FROM historical_records
                )
                GROUP BY meal_type
            ''')
            meal_distribution = [dict(row) for row in cursor.fetchall()]

            cursor.execute('''
                SELECT 
                    fi.name,
                    fi.category,
                    fi.unit,
                    ROUND(SUM(hr.actual_quantity_consumed), 1) as total_consumed,
                    ROUND(AVG(hr.actual_quantity_consumed), 1) as avg_per_service
                FROM historical_records hr
                JOIN food_items fi ON hr.food_item_id = fi.id
                GROUP BY fi.id
                ORDER BY total_consumed DESC
                LIMIT 5
            ''')
            top_food_items = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return jsonify({
            "success": True,
            "data": {
                "total_hotels": total_hotels,
                "total_food_items": total_food_items,
                "total_historical_records": total_historical_records,
                "total_predictions": total_predictions,
                "recent_predictions": recent_predictions,
                "guest_trends": guest_trends,
                "meal_distribution": meal_distribution,
                "top_food_items": top_food_items
            }
        })
    except Exception as e:
        conn.close()
        return jsonify({"success": False, "error": str(e)}), 500
