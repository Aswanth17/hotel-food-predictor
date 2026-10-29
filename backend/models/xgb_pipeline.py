"""
XGBoost training pipeline for Hotel Food Predictor.
Runs alongside the existing pure-Python Random Forest for fair comparison.
"""
import os
import sys
import json
import math
import random
from datetime import datetime

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from config import Config
from database import get_db_connection

XGB_GUEST_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'xgb_guest_count_model.json')
XGB_FOOD_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'xgb_food_quantity_model.json')

XGB_AVAILABLE = False
try:
    import xgboost as xgb
    import numpy as np
    XGB_AVAILABLE = True
except Exception as e:
    print(f"XGBoost not available: {e}")

def calculate_metrics(y_true, y_pred):
    n = len(y_true)
    if n == 0:
        return 0.0, 0.0, 0.0, None
    mae = sum(abs(y_true[i] - y_pred[i]) for i in range(n)) / n
    mse = sum((y_true[i] - y_pred[i]) ** 2 for i in range(n)) / n
    rmse = math.sqrt(mse)
    mean_y = sum(y_true) / n
    ss_tot = sum((y_true[i] - mean_y) ** 2 for i in range(n))
    ss_res = sum((y_true[i] - y_pred[i]) ** 2 for i in range(n))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    # MAPE - only when no zero actuals
    mape = None
    nonzero = [(y_true[i], y_pred[i]) for i in range(n) if y_true[i] != 0]
    if nonzero:
        mape = 100.0 * sum(abs(a - p) / abs(a) for a, p in nonzero) / len(nonzero)
    return round(mae, 2), round(rmse, 2), round(r2, 4), (round(mape, 2) if mape is not None else None)

def load_data_from_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT hr.hotel_id, h.dining_capacity, h.star_rating,
               hr.record_date, hr.meal_type, fi.category as food_category,
               fi.unit, fi.default_consumption_per_guest,
               hr.actual_guest_count, hr.actual_quantity_consumed,
               hr.day_of_week, hr.is_weekend, hr.is_holiday_or_event, hr.season
        FROM historical_records hr
        JOIN hotels h ON hr.hotel_id = h.id
        JOIN food_items fi ON hr.food_item_id = fi.id
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def train_xgb_guest_count():
    if not XGB_AVAILABLE:
        return {"success": False, "error": "XGBoost is not installed. Run: pip install xgboost"}

    records = load_data_from_db()
    if len(records) < 20:
        return {"success": False, "error": f"Insufficient data ({len(records)} records)"}

    # Deduplicate to distinct service events
    seen = set()
    service_rows = []
    for r in records:
        key = (r['hotel_id'], r['record_date'], r['meal_type'])
        if key not in seen:
            seen.add(key)
            service_rows.append(r)

    feature_names = [
        'dining_capacity','star_rating','day_of_week','month','is_weekend',
        'is_holiday_or_event','meal_Breakfast','meal_Lunch','meal_Dinner',
        'season_Winter','season_Spring','season_Summer','season_Autumn'
    ]

    X, y = [], []
    for r in service_rows:
        dt = datetime.strptime(r['record_date'], '%Y-%m-%d')
        month = dt.month
        meal = r['meal_type']
        season = r['season'] or 'Autumn'
        row = [
            float(r['dining_capacity']), float(r['star_rating']),
            float(r['day_of_week']), float(month),
            float(r['is_weekend']), float(r['is_holiday_or_event']),
            1.0 if meal == 'Breakfast' else 0.0,
            1.0 if meal == 'Lunch' else 0.0,
            1.0 if meal == 'Dinner' else 0.0,
            1.0 if season == 'Winter' else 0.0,
            1.0 if season == 'Spring' else 0.0,
            1.0 if season == 'Summer' else 0.0,
            1.0 if season == 'Autumn' else 0.0,
        ]
        X.append(row)
        y.append(float(r['actual_guest_count']))

    random.seed(42)
    indices = list(range(len(X)))
    random.shuffle(indices)
    split_idx = int(len(X) * 0.80)
    train_idx, test_idx = indices[:split_idx], indices[split_idx:]

    X_train = np.array([X[i] for i in train_idx])
    y_train = np.array([y[i] for i in train_idx])
    X_test  = np.array([X[i] for i in test_idx])
    y_test  = [y[i] for i in test_idx]

    model = xgb.XGBRegressor(
        n_estimators=100, max_depth=5, learning_rate=0.1,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
        verbosity=0
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test).tolist()

    mae, rmse, r2, mape = calculate_metrics(y_test, y_pred)

    # Save model as JSON
    model.save_model(XGB_GUEST_MODEL_PATH)
    meta = {
        'model_name': 'xgb_guest_count_predictor',
        'algorithm': 'XGBoost Regressor',
        'feature_names': feature_names,
        'metrics': {'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape},
        'trained_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    meta_path = XGB_GUEST_MODEL_PATH.replace('.json', '_meta.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f)

    # Store in DB
    fi_json = json.dumps({f: round(float(v), 4) for f, v in zip(feature_names, model.feature_importances_)})
    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT INTO model_metrics
            (model_name, algorithm, training_date, dataset_size, train_size, test_size,
             mae, rmse, r2_score, mape, feature_importances, target_variable, is_reliable, algorithm_key)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            'xgb_guest_count_predictor','XGBoost Regressor (100 Estimators, Depth=5)',
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            len(service_rows), len(train_idx), len(test_idx),
            mae, rmse, r2, mape, fi_json,
            'actual_guest_count (Headcount)', 1 if r2 >= 0 else 0, 'xgboost'
        ))
        conn.commit()
    except Exception as e:
        print(f"DB insert error: {e}")
    finally:
        conn.close()

    return {
        "success": True, "model_name": "xgb_guest_count_predictor",
        "dataset_size": len(service_rows), "train_size": len(train_idx), "test_size": len(test_idx),
        "mae": mae, "rmse": rmse, "r2_score": r2, "mape": mape
    }

def train_xgb_food_quantity():
    if not XGB_AVAILABLE:
        return {"success": False, "error": "XGBoost is not installed"}

    records = load_data_from_db()
    if len(records) < 30:
        return {"success": False, "error": f"Insufficient data ({len(records)} records)"}

    random.seed(42)
    sample_records = random.sample(records, min(1000, len(records)))
    categories = list(set(r['food_category'] for r in sample_records))

    feature_names = [
        'dining_capacity','default_consumption_per_guest','actual_guest_count',
        'day_of_week','month','is_weekend','is_holiday_or_event',
        'meal_Breakfast','meal_Lunch','meal_Dinner'
    ] + [f"cat_{c}" for c in categories]

    X, y = [], []
    for r in sample_records:
        dt = datetime.strptime(r['record_date'], '%Y-%m-%d')
        month = dt.month
        meal = r['meal_type']
        row = [
            float(r['dining_capacity']), float(r['default_consumption_per_guest']),
            float(r['actual_guest_count']), float(r['day_of_week']), float(month),
            float(r['is_weekend']), float(r['is_holiday_or_event']),
            1.0 if meal == 'Breakfast' else 0.0,
            1.0 if meal == 'Lunch' else 0.0,
            1.0 if meal == 'Dinner' else 0.0,
        ] + [1.0 if r['food_category'] == c else 0.0 for c in categories]
        X.append(row)
        y.append(float(r['actual_quantity_consumed']))

    indices = list(range(len(X)))
    random.shuffle(indices)
    split_idx = int(len(X) * 0.80)
    train_idx, test_idx = indices[:split_idx], indices[split_idx:]

    X_train = np.array([X[i] for i in train_idx])
    y_train = np.array([y[i] for i in train_idx])
    X_test  = np.array([X[i] for i in test_idx])
    y_test  = [y[i] for i in test_idx]

    model = xgb.XGBRegressor(
        n_estimators=100, max_depth=5, learning_rate=0.1,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
        verbosity=0
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test).tolist()
    mae, rmse, r2, mape = calculate_metrics(y_test, y_pred)

    model.save_model(XGB_FOOD_MODEL_PATH)
    meta = {
        'model_name': 'xgb_food_quantity_predictor',
        'algorithm': 'XGBoost Regressor',
        'categories': categories,
        'feature_names': feature_names,
        'metrics': {'mae': mae, 'rmse': rmse, 'r2': r2, 'mape': mape},
        'trained_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    meta_path = XGB_FOOD_MODEL_PATH.replace('.json', '_meta.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f)

    fi_json = json.dumps({f: round(float(v), 4) for f, v in zip(feature_names, model.feature_importances_)})
    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT INTO model_metrics
            (model_name, algorithm, training_date, dataset_size, train_size, test_size,
             mae, rmse, r2_score, mape, feature_importances, target_variable, is_reliable, algorithm_key)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            'xgb_food_quantity_predictor','XGBoost Regressor (100 Estimators, Depth=5)',
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            len(sample_records), len(train_idx), len(test_idx),
            mae, rmse, r2, mape, fi_json,
            'actual_quantity_consumed (kg/litres/pieces)', 1 if r2 >= 0 else 0, 'xgboost'
        ))
        conn.commit()
    except Exception as e:
        print(f"DB insert error: {e}")
    finally:
        conn.close()

    return {
        "success": True, "model_name": "xgb_food_quantity_predictor",
        "dataset_size": len(sample_records), "train_size": len(train_idx), "test_size": len(test_idx),
        "mae": mae, "rmse": rmse, "r2_score": r2, "mape": mape
    }

def train_all_xgb():
    guest = train_xgb_guest_count()
    food = train_xgb_food_quantity()
    return {"success": True, "guest_model": guest, "food_model": food, "timestamp": datetime.now().isoformat()}

if __name__ == '__main__':
    import json
    res = train_all_xgb()
    print(json.dumps(res, indent=2))
