import io
import csv
from flask import Blueprint, request, jsonify, Response
from database import get_db_connection

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/summary', methods=['GET'])
def get_report_summary():
    hotel_id = request.args.get('hotel_id')
    food_item_id = request.args.get('food_item_id')
    meal_type = request.args.get('meal_type')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Predictions Summary
    pred_query = '''
        SELECT 
            COUNT(p.id) as prediction_count,
            COALESCE(SUM(p.predicted_guest_count), 0) as total_predicted_guests,
            COALESCE(SUM(p.recommended_food_quantity), 0) as total_recommended_quantity,
            COALESCE(AVG(p.predicted_guest_count), 0) as avg_predicted_guests,
            COALESCE(SUM(p.recommended_food_quantity * fi.cost_per_unit), 0) as estimated_provision_cost
        FROM predictions p
        JOIN food_items fi ON p.food_item_id = fi.id
        WHERE 1=1
    '''
    pred_params = []
    if hotel_id:
        pred_query += " AND p.hotel_id = ?"
        pred_params.append(hotel_id)
    if food_item_id:
        pred_query += " AND p.food_item_id = ?"
        pred_params.append(food_item_id)
    if meal_type:
        pred_query += " AND p.meal_type = ?"
        pred_params.append(meal_type)
    if from_date:
        pred_query += " AND p.prediction_date >= ?"
        pred_params.append(from_date)
    if to_date:
        pred_query += " AND p.prediction_date <= ?"
        pred_params.append(to_date)

    cursor.execute(pred_query, pred_params)
    pred_stats = dict(cursor.fetchone())

    # 2. Historical Actuals Summary
    hist_query = '''
        SELECT 
            COUNT(hr.id) as service_record_count,
            COALESCE(SUM(hr.actual_guest_count), 0) as total_actual_guests,
            COALESCE(SUM(hr.actual_quantity_consumed), 0) as total_actual_consumed,
            COALESCE(SUM(hr.waste_quantity), 0) as total_actual_waste,
            COALESCE(AVG(hr.actual_guest_count), 0) as avg_actual_guests
        FROM historical_records hr
        JOIN food_items fi ON hr.food_item_id = fi.id
        WHERE 1=1
    '''
    hist_params = []
    if hotel_id:
        hist_query += " AND hr.hotel_id = ?"
        hist_params.append(hotel_id)
    if food_item_id:
        hist_query += " AND hr.food_item_id = ?"
        hist_params.append(food_item_id)
    if meal_type:
        hist_query += " AND hr.meal_type = ?"
        hist_params.append(meal_type)
    if from_date:
        hist_query += " AND hr.record_date >= ?"
        hist_params.append(from_date)
    if to_date:
        hist_query += " AND hr.record_date <= ?"
        hist_params.append(to_date)

    cursor.execute(hist_query, hist_params)
    hist_stats = dict(cursor.fetchone())

    # 3. Aggregated by Food Item
    cursor.execute('''
        SELECT 
            fi.name as food_item_name,
            fi.category,
            fi.unit,
            fi.cost_per_unit,
            COUNT(p.id) as predictions_made,
            ROUND(SUM(p.recommended_food_quantity), 2) as sum_recommended_qty,
            ROUND(AVG(p.recommended_food_quantity), 2) as avg_recommended_qty,
            ROUND(SUM(p.recommended_food_quantity * fi.cost_per_unit), 2) as total_projected_cost
        FROM predictions p
        JOIN food_items fi ON p.food_item_id = fi.id
        GROUP BY fi.id
        ORDER BY sum_recommended_qty DESC
    ''')
    item_aggregations = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "success": True,
        "data": {
            "predictions_summary": {
                "prediction_count": pred_stats['prediction_count'],
                "total_predicted_guests": int(pred_stats['total_predicted_guests']),
                "total_recommended_quantity": round(pred_stats['total_recommended_quantity'], 2),
                "avg_predicted_guests": round(pred_stats['avg_predicted_guests'], 1),
                "estimated_provision_cost": round(pred_stats['estimated_provision_cost'], 2)
            },
            "historical_actuals_summary": {
                "service_record_count": hist_stats['service_record_count'],
                "total_actual_guests": int(hist_stats['total_actual_guests']),
                "total_actual_consumed": round(hist_stats['total_actual_consumed'], 2),
                "total_actual_waste": round(hist_stats['total_actual_waste'], 2),
                "avg_actual_guests": round(hist_stats['avg_actual_guests'], 1)
            },
            "food_item_breakdown": item_aggregations
        }
    })

@reports_bp.route('/export', methods=['GET'])
def export_csv():
    report_type = request.args.get('type', 'predictions') # 'predictions' or 'historical'
    conn = get_db_connection()
    cursor = conn.cursor()

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == 'predictions':
        cursor.execute('''
            SELECT 
                p.id as prediction_id,
                h.name as hotel_name,
                p.prediction_date,
                p.meal_type,
                fi.name as food_item_name,
                fi.category as food_category,
                p.predicted_guest_count,
                p.base_estimated_quantity,
                p.safety_buffer_percent,
                p.recommended_food_quantity,
                p.unit,
                p.prediction_method,
                p.created_at as generated_timestamp
            FROM predictions p
            JOIN hotels h ON p.hotel_id = h.id
            JOIN food_items fi ON p.food_item_id = fi.id
            ORDER BY p.id DESC
        ''')
        rows = cursor.fetchall()
        writer.writerow([
            "Prediction ID", "Hotel Name", "Forecast Date", "Meal Type", 
            "Food Item", "Category", "Predicted Guest Count", "Base Estimated Qty", 
            "Safety Buffer %", "Recommended Food Quantity", "Unit", "Method", "Generated Timestamp"
        ])
        for row in rows:
            writer.writerow(list(row))
        filename = "hotel_food_predictions_export.csv"
    else:
        cursor.execute('''
            SELECT 
                hr.id as record_id,
                h.name as hotel_name,
                hr.record_date,
                hr.meal_type,
                fi.name as food_item_name,
                fi.category as food_category,
                hr.actual_guest_count,
                hr.actual_quantity_consumed,
                fi.unit,
                hr.actual_quantity_prepared,
                hr.waste_quantity,
                hr.occupancy_rate,
                hr.season,
                hr.source_type
            FROM historical_records hr
            JOIN hotels h ON hr.hotel_id = h.id
            JOIN food_items fi ON hr.food_item_id = fi.id
            ORDER BY hr.record_date DESC, hr.id DESC
        ''')
        rows = cursor.fetchall()
        writer.writerow([
            "Record ID", "Hotel Name", "Record Date", "Meal Type", 
            "Food Item", "Category", "Actual Guest Count", "Actual Quantity Consumed", 
            "Unit", "Quantity Prepared", "Waste Quantity", "Occupancy Rate", "Season", "Source Type"
        ])
        for row in rows:
            writer.writerow(list(row))
        filename = "hotel_historical_actuals_export.csv"

    conn.close()
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )


@reports_bp.route('/analytics', methods=['GET'])
def get_analytics():
    """Chart-ready analytics data for the ReportsPage: trends, distributions, top items."""
    hotel_id = request.args.get('hotel_id', type=int)
    days = request.args.get('days', 30, type=int)
    meal_type = request.args.get('meal_type')

    if not hotel_id:
        return jsonify({"success": False, "error": "hotel_id is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    base_pred = "FROM predictions p JOIN food_items fi ON p.food_item_id = fi.id WHERE p.hotel_id = ?"
    base_hist = "FROM historical_records hr JOIN food_items fi ON hr.food_item_id = fi.id WHERE hr.hotel_id = ?"
    params_pred = [hotel_id]
    params_hist = [hotel_id]

    if days:
        date_limit = f"date('now', '-{days} days')"
        base_pred += f" AND p.prediction_date >= {date_limit}"
        base_hist += f" AND hr.record_date >= {date_limit}"

    if meal_type:
        base_pred += " AND p.meal_type = ?"
        base_hist += " AND hr.meal_type = ?"
        params_pred.append(meal_type)
        params_hist.append(meal_type)

    # Overall summary stats
    cursor.execute(f'''
        SELECT COUNT(p.id) as total_predictions,
               ROUND(AVG(p.predicted_guest_count), 1) as avg_predicted_guests,
               ROUND(AVG(p.recommended_food_quantity), 2) as avg_recommended_quantity,
               fi.unit as most_common_unit,
               p.meal_type as most_common_meal
        {base_pred}
        GROUP BY fi.unit, p.meal_type ORDER BY COUNT(p.id) DESC LIMIT 1
    ''', params_pred)
    row = cursor.fetchone()
    summary = dict(row) if row else {
        "total_predictions": 0, "avg_predicted_guests": 0,
        "avg_recommended_quantity": 0, "most_common_unit": "kg", "most_common_meal": "—"
    }

    # Guest count trend (by date)
    cursor.execute(f'''
        SELECT p.prediction_date as date,
               ROUND(AVG(p.predicted_guest_count), 1) as avg_guest_count
        {base_pred}
        GROUP BY p.prediction_date
        ORDER BY p.prediction_date ASC
    ''', params_pred)
    guest_count_trend = [dict(r) for r in cursor.fetchall()]

    # Meal distribution
    cursor.execute(f'''
        SELECT p.meal_type, COUNT(p.id) as count
        {base_pred}
        GROUP BY p.meal_type ORDER BY count DESC
    ''', params_pred)
    meal_distribution = [dict(r) for r in cursor.fetchall()]

    # Top food items by avg recommended quantity
    cursor.execute(f'''
        SELECT fi.name as food_item_name, fi.unit,
               ROUND(AVG(p.recommended_food_quantity), 2) as avg_quantity,
               COUNT(p.id) as prediction_count
        {base_pred}
        GROUP BY fi.id ORDER BY avg_quantity DESC LIMIT 8
    ''', params_pred)
    top_food_items = [dict(r) for r in cursor.fetchall()]

    # Guest count by day of week
    days_map = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    cursor.execute(f'''
        SELECT strftime('%w', p.prediction_date) as dow_num,
               ROUND(AVG(p.predicted_guest_count), 1) as avg_guests,
               COUNT(p.id) as sample_count
        {base_pred}
        GROUP BY dow_num ORDER BY dow_num ASC
    ''', params_pred)
    dow_rows = [dict(r) for r in cursor.fetchall()]
    dow_map = {str(i): days_map[(i-1) % 7] for i in range(7)}
    guest_count_by_dow = [{"day_name": dow_map.get(r["dow_num"], r["dow_num"]), **r} for r in dow_rows]

    conn.close()
    return jsonify({
        "success": True,
        "data": {
            "summary": summary,
            "guest_count_trend": guest_count_trend,
            "meal_distribution": meal_distribution,
            "top_food_items": top_food_items,
            "guest_count_by_dow": guest_count_by_dow
        }
    })
