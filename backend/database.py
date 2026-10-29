import sqlite3
import os
import json
import random
from datetime import datetime, timedelta
from config import Config

def get_db_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(Config.DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Initializes tables, indexes, and triggers in the SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript('''
    -- Hotels table
    CREATE TABLE IF NOT EXISTS hotels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        city TEXT NOT NULL,
        total_rooms INTEGER NOT NULL DEFAULT 100,
        star_rating INTEGER NOT NULL DEFAULT 4,
        dining_capacity INTEGER NOT NULL DEFAULT 150,
        contact_email TEXT,
        contact_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Food Items catalogue
    CREATE TABLE IF NOT EXISTS food_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        unit TEXT NOT NULL CHECK(unit IN ('kg', 'litres', 'pieces')),
        default_consumption_per_guest REAL NOT NULL,
        cost_per_unit REAL NOT NULL DEFAULT 0.0,
        shelf_life_days INTEGER NOT NULL DEFAULT 2,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Historical Consumption and Guest Records
    CREATE TABLE IF NOT EXISTS historical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotel_id INTEGER NOT NULL,
        record_date DATE NOT NULL,
        meal_type TEXT NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
        food_item_id INTEGER NOT NULL,
        actual_guest_count INTEGER NOT NULL CHECK(actual_guest_count >= 0),
        actual_quantity_consumed REAL NOT NULL CHECK(actual_quantity_consumed >= 0),
        actual_quantity_prepared REAL,
        waste_quantity REAL,
        occupancy_rate REAL,
        day_of_week INTEGER, -- 0=Mon, 6=Sun
        is_weekend INTEGER DEFAULT 0,
        is_holiday_or_event INTEGER DEFAULT 0,
        season TEXT,
        source_type TEXT DEFAULT 'synthetic_demonstration', -- 'synthetic_demonstration', 'uploaded_csv', 'public_benchmark'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE
    );

    -- Unique composite index for duplicate detection
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_hotel_date_meal_item 
    ON historical_records (hotel_id, record_date, meal_type, food_item_id);

    -- Predictions history
    CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotel_id INTEGER NOT NULL,
        prediction_date DATE NOT NULL,
        meal_type TEXT NOT NULL,
        food_item_id INTEGER NOT NULL,
        predicted_guest_count INTEGER NOT NULL,
        base_estimated_quantity REAL NOT NULL,
        safety_buffer_percent REAL NOT NULL DEFAULT 5.0,
        recommended_food_quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        prediction_method TEXT NOT NULL, -- 'Random Forest Regression (Trained ML)', 'Historical Average Consumption Factor'
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        FOREIGN KEY (food_item_id) REFERENCES food_items(id) ON DELETE CASCADE
    );

    -- ML Model Metrics
    CREATE TABLE IF NOT EXISTS model_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT NOT NULL, -- 'guest_count_predictor', 'food_quantity_predictor'
        algorithm TEXT NOT NULL,
        training_date DATETIME NOT NULL,
        dataset_size INTEGER NOT NULL,
        train_size INTEGER NOT NULL,
        test_size INTEGER NOT NULL,
        mae REAL NOT NULL,
        rmse REAL NOT NULL,
        r2_score REAL NOT NULL,
        feature_importances TEXT, -- JSON string
        target_variable TEXT NOT NULL,
        is_reliable INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Application Settings
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT
    );

    -- Hotel Accounts (authentication) - v2.0
    CREATE TABLE IF NOT EXISTS hotel_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotel_id INTEGER NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );

    -- Hotel-specific Events (private per hotel) - v2.0
    CREATE TABLE IF NOT EXISTS hotel_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hotel_id INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        event_date DATE NOT NULL,
        event_end_date DATE,
        event_category TEXT NOT NULL DEFAULT 'Special Hotel Event',
        description TEXT,
        expected_guest_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );

    -- Public Holidays shared calendar - v2.0
    CREATE TABLE IF NOT EXISTS public_holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holiday_name TEXT NOT NULL,
        holiday_date DATE NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'Public Holiday',
        country TEXT DEFAULT 'IN',
        description TEXT
    );

    -- Admin Accounts (central administration & ML metrics) - v2.1
    CREATE TABLE IF NOT EXISTS admin_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'System Administrator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ''')

    # Safe migration: add new columns to model_metrics if not present
    for col_sql in [
        "ALTER TABLE model_metrics ADD COLUMN algorithm_key TEXT DEFAULT 'random_forest'",
        "ALTER TABLE model_metrics ADD COLUMN mape REAL",
    ]:
        try:
            cursor.execute(col_sql)
        except Exception:
            pass

    conn.commit()
    conn.close()
    seed_admin_if_missing()

def seed_admin_if_missing():
    """Ensures default admin account exists."""
    import bcrypt as _bcrypt
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM admin_accounts")
    if cursor.fetchone()[0] == 0:
        admin_pw_hash = _bcrypt.hashpw(b"admin123", _bcrypt.gensalt()).decode()
        cursor.execute(
            "INSERT OR IGNORE INTO admin_accounts (email, password_hash, name) VALUES (?,?,?)",
            ("admin@hotelpredictor.com", admin_pw_hash, "System Administrator")
        )
        conn.commit()
        print("Seeded admin account: admin@hotelpredictor.com / admin123")
    conn.close()

def seed_initial_data_if_empty():
    """Seeds realistic demonstration data if the database is currently empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if hotels already exist
    cursor.execute("SELECT COUNT(*) FROM hotels")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return False

    print("Database is empty. Seeding initial demonstration dataset...")

    # 1. Seed Hotels
    sample_hotels = [
        ("The Grand Horizon Palace", "Metro City", 220, 5, 300, "concierge@grandhorizon.com", "+1-555-0101"),
        ("Royal Palm Resort & Spa", "Coastal Beach", 180, 5, 250, "reservations@royalpalm.com", "+1-555-0102"),
        ("Highland View Heritage Inn", "Hill Station", 90, 4, 120, "manager@highlandinn.com", "+1-555-0103"),
        ("Azure Bay Business Hotel", "Financial District", 140, 4, 180, "frontdesk@azurebay.com", "+1-555-0104"),
        ("Sapphire Suites & Convention", "Airport Hub", 200, 4, 260, "events@sapphiresuites.com", "+1-555-0105")
    ]
    cursor.executemany(
        "INSERT INTO hotels (name, city, total_rooms, star_rating, dining_capacity, contact_email, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)",
        sample_hotels
    )

    # 2. Seed Food Catalogue
    sample_food_items = [
        ("Steamed Basmati Rice", "Main Course", "kg", 0.180, 1.80, 1),
        ("Butter Chicken Gravy", "Main Course", "kg", 0.220, 6.50, 2),
        ("Paneer Tikka Masala", "Main Course", "kg", 0.200, 5.20, 2),
        ("Dal Makhani", "Main Course", "kg", 0.160, 3.00, 2),
        ("Fresh Orange & Fruit Juice", "Beverage", "litres", 0.250, 2.40, 1),
        ("Brewed Roast Coffee", "Beverage", "litres", 0.200, 1.90, 1),
        ("Whole Fresh Milk", "Dairy", "litres", 0.150, 1.20, 3),
        ("Plain Greek Yogurt", "Dairy", "kg", 0.120, 2.80, 4),
        ("Fresh Butter Croissants", "Bakery", "pieces", 1.400, 0.75, 2),
        ("Artisan Dinner Rolls", "Bakery", "pieces", 1.250, 0.45, 2),
        ("Fresh Scrambled Eggs", "Breakfast Special", "kg", 0.140, 3.20, 1),
        ("Crispy Hash Browns", "Breakfast Special", "pieces", 1.800, 0.40, 2),
        ("Mediterranean Garden Salad", "Salad", "kg", 0.110, 3.50, 1),
        ("Grilled Chicken Breast Cutlets", "Main Course", "kg", 0.210, 7.20, 2),
        ("Warm Chocolate Brownies", "Dessert", "pieces", 1.100, 0.85, 3),
        ("Vanilla Panna Cotta Cups", "Dessert", "pieces", 1.000, 1.10, 2)
    ]
    cursor.executemany(
        "INSERT INTO food_items (name, category, unit, default_consumption_per_guest, cost_per_unit, shelf_life_days) VALUES (?, ?, ?, ?, ?, ?)",
        sample_food_items
    )

    # 3. Seed Settings
    sample_settings = [
        ("default_safety_buffer", "5.0", "Default safety buffer percentage added to predicted food quantities (0-25%)"),
        ("app_name", "Food Provision Requirement Predictor for Hotels", "Application display title"),
        ("currency_symbol", "$", "Currency symbol for food cost reporting"),
        ("model_retraining_threshold_days", "30", "Recommended model refresh interval in days")
    ]
    cursor.executemany(
        "INSERT INTO settings (key, value, description) VALUES (?, ?, ?)",
        sample_settings
    )

    conn.commit()

    # 4. Generate 60 days of synthetic demonstration historical records
    # We use a fixed random seed for reproducible and realistic demo data
    random.seed(42)

    cursor.execute("SELECT id, dining_capacity, star_rating FROM hotels")
    hotels = cursor.fetchall()

    cursor.execute("SELECT id, category, default_consumption_per_guest FROM food_items")
    food_items = cursor.fetchall()

    # Generate records for the last 60 days up to yesterday
    end_date = datetime.now().date() - timedelta(days=1)
    start_date = end_date - timedelta(days=60)

    # Meal suitability mapping to ensure realistic meals
    meal_categories = {
        'Breakfast': ['Bakery', 'Breakfast Special', 'Beverage', 'Dairy'],
        'Lunch': ['Main Course', 'Salad', 'Beverage', 'Dessert'],
        'Dinner': ['Main Course', 'Salad', 'Beverage', 'Dessert']
    }

    historical_records = []
    current_date = start_date

    while current_date <= end_date:
        dow = current_date.weekday() # 0 = Mon, 6 = Sun
        is_weekend = 1 if dow in [4, 5, 6] else 0 # Fri, Sat, Sun
        month = current_date.month
        # Season determination
        if month in [12, 1, 2]:
            season = 'Winter'
        elif month in [3, 4, 5]:
            season = 'Spring'
        elif month in [6, 7, 8]:
            season = 'Summer'
        else:
            season = 'Autumn'

        # Event/Holiday flag (randomly 10% probability, higher on weekends)
        is_event = 1 if (random.random() < 0.12 or (is_weekend and random.random() < 0.20)) else 0

        for hotel in hotels:
            hotel_id = hotel['id']
            capacity = hotel['dining_capacity']

            # Base occupancy rate depending on hotel type, weekend, and events
            base_occupancy = 0.60 + (0.15 if is_weekend else 0.0) + (0.12 if is_event else 0.0)
            base_occupancy += random.uniform(-0.06, 0.06)
            base_occupancy = max(0.35, min(0.98, base_occupancy))

            for meal in ['Breakfast', 'Lunch', 'Dinner']:
                # Meal factor: Breakfast is highest in hotels (included in room packages),
                # Dinner is next, Lunch is moderate
                meal_factor = 1.0 if meal == 'Breakfast' else (0.80 if meal == 'Dinner' else 0.65)
                actual_guests = int(capacity * base_occupancy * meal_factor)
                actual_guests = max(15, actual_guests)

                # Filter food items suitable for this meal
                allowed_cats = meal_categories[meal]
                eligible_items = [f for f in food_items if f['category'] in allowed_cats]

                # Select a subset of items to keep realistic buffet variation
                for item in eligible_items:
                    item_id = item['id']
                    base_consumption_rate = item['default_consumption_per_guest']

                    # Natural per-guest variance: +- 8%
                    variance = random.uniform(0.92, 1.08)
                    consumed = round(actual_guests * base_consumption_rate * variance, 2)

                    # Kitchens prepare slightly more to prevent running out (buffer ~5-8%)
                    prepared_buffer = random.uniform(1.04, 1.08)
                    prepared = round(consumed * prepared_buffer, 2)
                    waste = round(prepared - consumed, 2)

                    historical_records.append((
                        hotel_id,
                        current_date.strftime('%Y-%m-%d'),
                        meal,
                        item_id,
                        actual_guests,
                        consumed,
                        prepared,
                        waste,
                        round(base_occupancy, 2),
                        dow,
                        is_weekend,
                        is_event,
                        season,
                        'synthetic_demonstration'
                    ))

        current_date += timedelta(days=1)

    cursor.executemany('''
        INSERT OR IGNORE INTO historical_records 
        (hotel_id, record_date, meal_type, food_item_id, actual_guest_count, actual_quantity_consumed, 
         actual_quantity_prepared, waste_quantity, occupancy_rate, day_of_week, is_weekend, is_holiday_or_event, season, source_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', historical_records)

    conn.commit()
    print(f"Successfully seeded {len(historical_records)} historical records across 5 hotels.")

    # 5. Seed a few realistic recent predictions to populate the dashboard and history initially
    cursor.execute("SELECT id FROM hotels LIMIT 2")
    sample_h_ids = [r['id'] for r in cursor.fetchall()]

    cursor.execute("SELECT id, unit FROM food_items LIMIT 5")
    sample_f_items = cursor.fetchall()

    recent_preds = []
    for i in range(1, 8):
        pred_date = (datetime.now().date() + timedelta(days=i)).strftime('%Y-%m-%d')
        h_id = random.choice(sample_h_ids)
        meal = random.choice(['Breakfast', 'Lunch', 'Dinner'])
        f_item = random.choice(sample_f_items)

        pred_guests = random.randint(70, 190)
        base_qty = round(pred_guests * 0.18, 2) if f_item['unit'] == 'kg' else (
            round(pred_guests * 0.22, 2) if f_item['unit'] == 'litres' else round(pred_guests * 1.3, 1)
        )
        buffer_val = 5.0
        final_qty = round(base_qty * (1 + buffer_val / 100.0), 2)

        recent_preds.append((
            h_id,
            pred_date,
            meal,
            f_item['id'],
            pred_guests,
            base_qty,
            buffer_val,
            final_qty,
            f_item['unit'],
            'Random Forest Regression (Trained ML)',
            f'Initial demonstration forecast with 5% safety buffer.'
        ))

    cursor.executemany('''
        INSERT INTO predictions 
        (hotel_id, prediction_date, meal_type, food_item_id, predicted_guest_count, base_estimated_quantity, 
         safety_buffer_percent, recommended_food_quantity, unit, prediction_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', recent_preds)

    conn.commit()

    # 6. Seed public holidays (India 2026)
    ph_count = cursor.execute("SELECT COUNT(*) FROM public_holidays").fetchone()[0]
    if ph_count == 0:
        public_holidays_data = [
            ("New Year's Day",      "2026-01-01", "Public Holiday", "IN", "New Year celebration"),
            ("Republic Day",        "2026-01-26", "Public Holiday", "IN", "Indian Republic Day"),
            ("Holi",                "2026-03-21", "Festival",       "IN", "Festival of Colors"),
            ("Good Friday",         "2026-04-03", "Public Holiday", "IN", "Good Friday"),
            ("Eid ul-Fitr",         "2026-04-02", "Festival",       "IN", "End of Ramadan"),
            ("Independence Day",    "2026-08-15", "Public Holiday", "IN", "Indian Independence Day"),
            ("Gandhi Jayanti",      "2026-10-02", "Public Holiday", "IN", "Gandhi's Birthday"),
            ("Dussehra",            "2026-10-22", "Festival",       "IN", "Victory of good over evil"),
            ("Diwali",              "2026-11-08", "Festival",       "IN", "Festival of Lights"),
            ("Christmas",           "2026-12-25", "Public Holiday", "IN", "Christmas Day"),
            ("New Year's Eve",      "2026-12-31", "Festival",       "IN", "New Year Eve celebration"),
        ]
        cursor.executemany(
            "INSERT OR IGNORE INTO public_holidays (holiday_name, holiday_date, category, country, description) VALUES (?,?,?,?,?)",
            public_holidays_data
        )
        conn.commit()
        print("Seeded public holidays calendar.")

    # 7. Seed hotel accounts for demo hotels
    import bcrypt as _bcrypt
    acct_count = cursor.execute("SELECT COUNT(*) FROM hotel_accounts").fetchone()[0]
    if acct_count == 0:
        demo_accounts = [
            (1, "grand@hotel.com",     "password123"),
            (2, "royalpalm@hotel.com", "password123"),
            (3, "highland@hotel.com",  "password123"),
            (4, "azurebay@hotel.com",  "password123"),
            (5, "sapphire@hotel.com",  "password123"),
        ]
        for hotel_id, email, plain_pw in demo_accounts:
            pw_hash = _bcrypt.hashpw(plain_pw.encode(), _bcrypt.gensalt()).decode()
            try:
                cursor.execute(
                    "INSERT OR IGNORE INTO hotel_accounts (hotel_id, email, password_hash) VALUES (?,?,?)",
                    (hotel_id, email, pw_hash)
                )
            except Exception:
                pass
        conn.commit()
        print("Seeded 5 demo hotel accounts (e.g. grand@hotel.com / password123)")

    # 8. Seed admin account if missing
    admin_count = cursor.execute("SELECT COUNT(*) FROM admin_accounts").fetchone()[0]
    if admin_count == 0:
        admin_pw_hash = _bcrypt.hashpw(b"admin123", _bcrypt.gensalt()).decode()
        cursor.execute(
            "INSERT OR IGNORE INTO admin_accounts (email, password_hash, name) VALUES (?,?,?)",
            ("admin@hotelpredictor.com", admin_pw_hash, "System Administrator")
        )
        conn.commit()
        print("Seeded admin account (admin@hotelpredictor.com / admin123)")

    conn.close()
    return True

if __name__ == '__main__':
    init_db()
    seed_initial_data_if_empty()
