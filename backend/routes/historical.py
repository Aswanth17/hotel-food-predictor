import io
import csv
import os
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from database import get_db_connection
from config import Config

historical_bp = Blueprint('historical', __name__)

REQUIRED_COLUMNS = ['hotel_name', 'record_date', 'meal_type', 'food_item_name', 'actual_guest_count', 'actual_quantity_consumed', 'unit']
VALID_MEALS = {'Breakfast', 'Lunch', 'Dinner'}
VALID_UNITS = {'kg', 'litres', 'pieces'}

@historical_bp.route('', methods=['GET'])
def get_historical_records():
    hotel_id = request.args.get('hotel_id')
    meal_type = request.args.get('meal_type')
    food_item_id = request.args.get('food_item_id')
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    search = (request.args.get('search') or '').strip()
    page = max(1, int(request.args.get('page', 1)))
    limit = max(1, min(100, int(request.args.get('limit', 25))))
    offset = (page - 1) * limit

    conn = get_db_connection()
    cursor = conn.cursor()

    query = '''
        SELECT 
            hr.id,
            hr.record_date,
            hr.meal_type,
            h.id as hotel_id,
            h.name as hotel_name,
            fi.id as food_item_id,
            fi.name as food_item_name,
            fi.category as food_category,
            fi.unit,
            hr.actual_guest_count,
            hr.actual_quantity_consumed,
            hr.actual_quantity_prepared,
            hr.waste_quantity,
            hr.occupancy_rate,
            hr.is_weekend,
            hr.is_holiday_or_event,
            hr.season,
            hr.source_type,
            hr.created_at
        FROM historical_records hr
        JOIN hotels h ON hr.hotel_id = h.id
        JOIN food_items fi ON hr.food_item_id = fi.id
        WHERE 1=1
    '''
    params = []

    if hotel_id:
        query += " AND hr.hotel_id = ?"
        params.append(hotel_id)

    if meal_type:
        query += " AND hr.meal_type = ?"
        params.append(meal_type)

    if food_item_id:
        query += " AND hr.food_item_id = ?"
        params.append(food_item_id)

    if from_date:
        query += " AND hr.record_date >= ?"
        params.append(from_date)

    if to_date:
        query += " AND hr.record_date <= ?"
        params.append(to_date)

    if search:
        query += " AND (h.name LIKE ? OR fi.name LIKE ? OR fi.category LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    count_query = f"SELECT COUNT(*) FROM ({query})"
    cursor.execute(count_query, params)
    total_records = cursor.fetchone()[0]

    query += " ORDER BY hr.record_date DESC, hr.id DESC LIMIT ? OFFSET ?"
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

@historical_bp.route('/preview', methods=['POST'])
def preview_csv():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded. Please upload a CSV file."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "Empty filename."}), 400

    if not file.filename.lower().endswith('.csv'):
        return jsonify({"success": False, "error": "Invalid file format. Only CSV files are supported."}), 400

    try:
        content = file.stream.read().decode('utf-8', errors='replace')
        stream = io.StringIO(content)
        reader = csv.DictReader(stream)

        if not reader.fieldnames:
            return jsonify({"success": False, "error": "CSV file contains no headers or is empty."}), 400

        headers = [h.strip() for h in reader.fieldnames]
        missing_headers = [req for req in REQUIRED_COLUMNS if req not in headers]

        if missing_headers:
            return jsonify({
                "success": False,
                "error": f"Missing required columns in CSV: {', '.join(missing_headers)}",
                "detected_headers": headers,
                "required_headers": REQUIRED_COLUMNS
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Pre-load existing hotel and food maps for key resolution
        cursor.execute("SELECT id, LOWER(name) as name FROM hotels")
        hotel_map = {row['name']: row['id'] for row in cursor.fetchall()}

        cursor.execute("SELECT id, LOWER(name) as name FROM food_items")
        food_map = {row['name']: row['id'] for row in cursor.fetchall()}

        preview_rows = []
        validation_errors = []
        duplicate_count = 0
        valid_count = 0
        seen_in_batch = set()

        row_idx = 1
        for row in reader:
            row_idx += 1
            h_name = (row.get('hotel_name') or '').strip()
            rec_date = (row.get('record_date') or '').strip()
            meal = (row.get('meal_type') or '').strip()
            f_name = (row.get('food_item_name') or '').strip()
            guest_str = (row.get('actual_guest_count') or '').strip()
            qty_str = (row.get('actual_quantity_consumed') or '').strip()
            unit = (row.get('unit') or '').strip().lower()

            status = 'valid'
            row_issues = []

            # 1. Check blank fields
            if not h_name or not rec_date or not meal or not f_name or not guest_str or not qty_str:
                status = 'invalid'
                row_issues.append("Missing required fields")

            # 2. Check meal validity
            if meal not in VALID_MEALS:
                status = 'invalid'
                row_issues.append(f"Invalid meal '{meal}'. Must be Breakfast, Lunch, or Dinner")

            # 3. Check unit validity
            if unit not in VALID_UNITS:
                status = 'invalid'
                row_issues.append(f"Invalid unit '{unit}'. Must be kg, litres, or pieces")

            # 4. Check numbers
            try:
                guests = int(guest_str)
                if guests < 0:
                    status = 'invalid'
                    row_issues.append("Guest count cannot be negative")
            except ValueError:
                status = 'invalid'
                row_issues.append("Guest count must be an integer")

            try:
                qty = float(qty_str)
                if qty < 0:
                    status = 'invalid'
                    row_issues.append("Consumed quantity cannot be negative")
            except ValueError:
                status = 'invalid'
                row_issues.append("Consumed quantity must be a decimal/float")

            # 5. Check date format
            try:
                datetime.strptime(rec_date, '%Y-%m-%d')
            except ValueError:
                status = 'invalid'
                row_issues.append("Invalid date format. Expected YYYY-MM-DD")

            # 6. Check duplicate in incoming batch
            batch_key = (h_name.lower(), rec_date, meal, f_name.lower())
            if batch_key in seen_in_batch:
                status = 'duplicate_in_file'
                row_issues.append("Duplicate record in uploaded file")
                duplicate_count += 1
            else:
                seen_in_batch.add(batch_key)

            # 7. Check duplicate against database
            h_id = hotel_map.get(h_name.lower())
            f_id = food_map.get(f_name.lower())
            if h_id and f_id and status != 'duplicate_in_file':
                cursor.execute('''
                    SELECT id FROM historical_records 
                    WHERE hotel_id = ? AND record_date = ? AND meal_type = ? AND food_item_id = ?
                ''', (h_id, rec_date, meal, f_id))
                if cursor.fetchone():
                    status = 'duplicate_in_db'
                    row_issues.append("Record already exists in database for this hotel, date, meal, and item")
                    duplicate_count += 1

            if status == 'valid':
                valid_count += 1
            elif status == 'invalid':
                validation_errors.append({"row": row_idx, "issues": row_issues})

            if len(preview_rows) < 15:
                preview_rows.append({
                    "row_number": row_idx,
                    "hotel_name": h_name,
                    "record_date": rec_date,
                    "meal_type": meal,
                    "food_item_name": f_name,
                    "actual_guest_count": guest_str,
                    "actual_quantity_consumed": qty_str,
                    "unit": unit,
                    "status": status,
                    "issues": row_issues
                })

        conn.close()

        return jsonify({
            "success": True,
            "data": {
                "detected_headers": headers,
                "total_rows_inspected": row_idx - 1,
                "valid_rows_count": valid_count,
                "duplicate_rows_count": duplicate_count,
                "invalid_rows_count": len(validation_errors),
                "preview_rows": preview_rows,
                "validation_errors": validation_errors[:20]
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to preview CSV: {str(e)}"}), 500

@historical_bp.route('/import', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No CSV file uploaded."}), 400

    file = request.files['file']
    dedup_strategy = request.form.get('deduplication_strategy', 'skip').lower() # 'skip', 'update', 'keep_both'

    try:
        content = file.stream.read().decode('utf-8', errors='replace')
        stream = io.StringIO(content)
        reader = csv.DictReader(stream)

        headers = [h.strip() for h in (reader.fieldnames or [])]
        missing_headers = [req for req in REQUIRED_COLUMNS if req not in headers]
        if missing_headers:
            return jsonify({"success": False, "error": f"Missing required columns: {', '.join(missing_headers)}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Cache existing hotels and food items
        cursor.execute("SELECT id, LOWER(name) as name FROM hotels")
        hotel_map = {row['name']: row['id'] for row in cursor.fetchall()}

        cursor.execute("SELECT id, LOWER(name) as name FROM food_items")
        food_map = {row['name']: row['id'] for row in cursor.fetchall()}

        imported_count = 0
        updated_count = 0
        skipped_duplicates = 0
        invalid_count = 0
        discarded_details = []

        row_idx = 1
        for row in reader:
            row_idx += 1
            h_name = (row.get('hotel_name') or '').strip()
            rec_date = (row.get('record_date') or '').strip()
            meal = (row.get('meal_type') or '').strip()
            f_name = (row.get('food_item_name') or '').strip()
            guest_str = (row.get('actual_guest_count') or '').strip()
            qty_str = (row.get('actual_quantity_consumed') or '').strip()
            unit = (row.get('unit') or '').strip().lower()

            # Optional fields
            prep_str = (row.get('actual_quantity_prepared') or '').strip()
            waste_str = (row.get('waste_quantity') or '').strip()
            occ_str = (row.get('occupancy_rate') or '').strip()
            weekend_str = (row.get('is_weekend') or '').strip()
            event_str = (row.get('is_holiday_or_event') or '').strip()
            season = (row.get('season') or '').strip()

            # Basic validations
            if not h_name or not rec_date or not meal or not f_name or not guest_str or not qty_str or unit not in VALID_UNITS or meal not in VALID_MEALS:
                invalid_count += 1
                discarded_details.append(f"Row {row_idx}: Missing required values or invalid meal/unit")
                continue

            try:
                guests = int(guest_str)
                qty = float(qty_str)
                dt = datetime.strptime(rec_date, '%Y-%m-%d')
                if guests < 0 or qty < 0:
                    invalid_count += 1
                    discarded_details.append(f"Row {row_idx}: Negative values not permitted")
                    continue
            except ValueError:
                invalid_count += 1
                discarded_details.append(f"Row {row_idx}: Invalid numbers or date format")
                continue

            dow = dt.weekday()
            is_weekend = int(weekend_str) if weekend_str in ['0', '1'] else (1 if dow in [4, 5, 6] else 0)
            is_event = int(event_str) if event_str in ['0', '1'] else 0
            if not season:
                month = dt.month
                season = 'Winter' if month in [12, 1, 2] else ('Spring' if month in [3, 4, 5] else ('Summer' if month in [6, 7, 8] else 'Autumn'))

            prep_qty = float(prep_str) if prep_str else round(qty * 1.05, 2)
            waste_qty = float(waste_str) if waste_str else round(prep_qty - qty, 2)
            occ_rate = float(occ_str) if occ_str else None

            # Auto-create Hotel if not present
            h_key = h_name.lower()
            if h_key not in hotel_map:
                cursor.execute(
                    "INSERT INTO hotels (name, city, total_rooms, star_rating, dining_capacity) VALUES (?, 'Uploaded Location', 100, 4, 150)",
                    (h_name,)
                )
                hotel_map[h_key] = cursor.lastrowid

            # Auto-create Food Item if not present
            f_key = f_name.lower()
            if f_key not in food_map:
                cursor.execute(
                    "INSERT INTO food_items (name, category, unit, default_consumption_per_guest) VALUES (?, 'General F&B', ?, ?)",
                    (f_name, unit, round(qty / max(1, guests), 3))
                )
                food_map[f_key] = cursor.lastrowid

            h_id = hotel_map[h_key]
            f_id = food_map[f_key]

            # Check existing duplicate
            cursor.execute('''
                SELECT id FROM historical_records 
                WHERE hotel_id = ? AND record_date = ? AND meal_type = ? AND food_item_id = ?
            ''', (h_id, rec_date, meal, f_id))
            existing_row = cursor.fetchone()

            if existing_row:
                if dedup_strategy == 'skip':
                    skipped_duplicates += 1
                    continue
                elif dedup_strategy == 'update':
                    cursor.execute('''
                        UPDATE historical_records 
                        SET actual_guest_count = ?, actual_quantity_consumed = ?, actual_quantity_prepared = ?, 
                            waste_quantity = ?, occupancy_rate = ?, is_weekend = ?, is_holiday_or_event = ?, season = ?, source_type = 'uploaded_csv'
                        WHERE id = ?
                    ''', (guests, qty, prep_qty, waste_qty, occ_rate, is_weekend, is_event, season, existing_row['id']))
                    updated_count += 1
                    continue

            # Insert as new record
            cursor.execute('''
                INSERT INTO historical_records 
                (hotel_id, record_date, meal_type, food_item_id, actual_guest_count, actual_quantity_consumed,
                 actual_quantity_prepared, waste_quantity, occupancy_rate, day_of_week, is_weekend, is_holiday_or_event, season, source_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded_csv')
            ''', (h_id, rec_date, meal, f_id, guests, qty, prep_qty, waste_qty, occ_rate, dow, is_weekend, is_event, season))
            imported_count += 1

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "message": f"Import completed. {imported_count} imported, {updated_count} updated, {skipped_duplicates} duplicates skipped.",
            "data": {
                "total_rows_processed": row_idx - 1,
                "imported_records": imported_count,
                "updated_records": updated_count,
                "skipped_duplicates": skipped_duplicates,
                "invalid_discarded_records": invalid_count,
                "deduplication_strategy_used": dedup_strategy,
                "sample_discarded_issues": discarded_details[:10]
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Import failed: {str(e)}"}), 500

@historical_bp.route('/template', methods=['GET'])
def download_template():
    template_path = os.path.join(Config.SAMPLE_DATA_DIR, 'sample_template.csv')
    if not os.path.exists(template_path):
        return jsonify({"success": False, "error": "Template file not found"}), 404
    return send_file(template_path, mimetype='text/csv', as_attachment=True, download_name='hotel_food_records_template.csv')
