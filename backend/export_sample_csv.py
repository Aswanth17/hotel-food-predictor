import sqlite3
import csv
import os

DB_PATH = 'hotel_food_predictor.db'
SAMPLE_CSV_PATH = os.path.join('data', 'sample_hotel_food_records.csv')
TEMPLATE_CSV_PATH = os.path.join('data', 'sample_template.csv')

def export_samples():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    query = '''
        SELECT 
            h.name as hotel_name,
            hr.record_date,
            hr.meal_type,
            fi.name as food_item_name,
            hr.actual_guest_count,
            hr.actual_quantity_consumed,
            fi.unit,
            hr.actual_quantity_prepared,
            hr.waste_quantity,
            hr.occupancy_rate,
            hr.is_weekend,
            hr.is_holiday_or_event,
            hr.season
        FROM historical_records hr
        JOIN hotels h ON hr.hotel_id = h.id
        JOIN food_items fi ON hr.food_item_id = fi.id
        ORDER BY hr.record_date DESC, h.name, hr.meal_type
        LIMIT 500
    '''
    cursor.execute(query)
    rows = cursor.fetchall()

    if not rows:
        print("No historical records to export.")
        conn.close()
        return

    headers = [
        "hotel_name", "record_date", "meal_type", "food_item_name",
        "actual_guest_count", "actual_quantity_consumed", "unit",
        "actual_quantity_prepared", "waste_quantity", "occupancy_rate",
        "is_weekend", "is_holiday_or_event", "season"
    ]

    # Write sample 500 records
    with open(SAMPLE_CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row[h] for h in headers])

    # Write clean template (first 10 records for easy user reference)
    with open(TEMPLATE_CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for row in rows[:10]:
            writer.writerow([row[h] for h in headers])

    print(f"Exported {len(rows)} sample records to {SAMPLE_CSV_PATH} and template to {TEMPLATE_CSV_PATH}")
    conn.close()

if __name__ == '__main__':
    export_samples()
