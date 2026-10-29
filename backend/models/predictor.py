import os
import sys
import json
from datetime import datetime

# Ensure backend root is on path
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from config import Config
from database import get_db_connection

GUEST_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'guest_count_model.json')
FOOD_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'food_quantity_model.json')


def get_season_from_month(month: int) -> str:
    if month in [12, 1, 2]:
        return 'Winter'
    elif month in [3, 4, 5]:
        return 'Spring'
    elif month in [6, 7, 8]:
        return 'Summer'
    return 'Autumn'


def _traverse_tree(node, x):
    """Recursively traverse a stored tree dict to predict one sample."""
    if 'val' in node:
        return node['val']
    feat_idx = node['feat']
    if x[feat_idx] <= node['thresh']:
        return _traverse_tree(node['left'], x)
    return _traverse_tree(node['right'], x)


def predict_forest(trees, x):
    """Average predictions from all trees (pure Python Random Forest inference)."""
    preds = [_traverse_tree(tree, x) for tree in trees]
    return sum(preds) / len(preds)


def predict_provision_requirement(
    hotel_id: int,
    date_str: str,
    meal_type: str,
    food_item_id: int,
    safety_buffer_percent: float = None,
    is_holiday_or_event: int = 0
) -> dict:
    """
    Produces the TWO mandatory outputs:
      1. Predicted Guest Count  (integer)
      2. Recommended Food Quantity  (float, in the item's configured unit)

    Step 1 uses the trained guest-count Random Forest (or a heuristic fallback).
    Step 2 uses the trained food-quantity Random Forest; if the model is absent or
           returns a non-positive value, it falls back to the defensible formula:
           base_qty = predicted_guests × historical_consumption_per_guest
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # -- Fetch hotel --
    cursor.execute(
        "SELECT id, name, dining_capacity, star_rating FROM hotels WHERE id = ?", (hotel_id,)
    )
    hotel = cursor.fetchone()
    if not hotel:
        conn.close()
        raise ValueError(f"Hotel with ID {hotel_id} not found.")

    # -- Fetch food item --
    cursor.execute(
        "SELECT id, name, category, unit, default_consumption_per_guest FROM food_items WHERE id = ?",
        (food_item_id,)
    )
    food_item = cursor.fetchone()
    if not food_item:
        conn.close()
        raise ValueError(f"Food item with ID {food_item_id} not found.")

    # -- Safety buffer from settings or argument --
    if safety_buffer_percent is None:
        cursor.execute("SELECT value FROM settings WHERE key = 'default_safety_buffer'")
        row = cursor.fetchone()
        safety_buffer_percent = float(row['value']) if row else Config.DEFAULT_SAFETY_BUFFER
    else:
        safety_buffer_percent = max(0.0, min(50.0, float(safety_buffer_percent)))

    # -- Parse date & calendar features --
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        conn.close()
        raise ValueError("Invalid date format. Expected YYYY-MM-DD.")

    dow = dt.weekday()           # 0 = Mon … 6 = Sun
    month = dt.month
    is_weekend = 1 if dow in [4, 5, 6] else 0
    is_event = 1 if int(is_holiday_or_event) > 0 else 0
    season = get_season_from_month(month)

    # ================================================================
    # STEP 1  —  PREDICT GUEST COUNT
    # ================================================================
    predicted_guest_count = None
    guest_method = "Trained Random Forest Regression"

    if os.path.exists(GUEST_MODEL_PATH):
        try:
            with open(GUEST_MODEL_PATH, 'r') as f:
                payload = json.load(f)
            feature_names = payload['feature_names']
            trees = payload['forest']['trees']

            row_dict = {feat: 0.0 for feat in feature_names}
            row_dict['dining_capacity'] = float(hotel['dining_capacity'])
            row_dict['star_rating'] = float(hotel['star_rating'])
            row_dict['day_of_week'] = float(dow)
            row_dict['month'] = float(month)
            row_dict['is_weekend'] = float(is_weekend)
            row_dict['is_holiday_or_event'] = float(is_event)
            row_dict[f'meal_{meal_type}'] = 1.0
            row_dict[f'season_{season}'] = 1.0

            x_vec = [row_dict.get(feat, 0.0) for feat in feature_names]
            raw_pred = predict_forest(trees, x_vec)
            predicted_guest_count = max(10, int(round(raw_pred)))
        except Exception as e:
            print(f"[Predictor] Guest model inference failed: {e}. Using heuristic.")

    if predicted_guest_count is None:
        guest_method = "Historical Occupancy Baseline (heuristic)"
        meal_factor = 0.90 if meal_type == 'Breakfast' else (0.75 if meal_type == 'Dinner' else 0.60)
        weekend_mult = 1.15 if is_weekend else 1.0
        predicted_guest_count = max(15, min(
            hotel['dining_capacity'],
            int(hotel['dining_capacity'] * 0.70 * meal_factor * weekend_mult)
        ))

    # ================================================================
    # STEP 2  —  PREDICT FOOD QUANTITY
    # ================================================================
    base_estimated_quantity = None
    food_method = "Trained Random Forest Regression"

    if os.path.exists(FOOD_MODEL_PATH):
        try:
            with open(FOOD_MODEL_PATH, 'r') as f:
                payload = json.load(f)
            feature_names = payload['feature_names']
            categories = payload.get('categories', [])
            trees = payload['forest']['trees']

            row_dict = {feat: 0.0 for feat in feature_names}
            row_dict['dining_capacity'] = float(hotel['dining_capacity'])
            row_dict['default_consumption_per_guest'] = float(food_item['default_consumption_per_guest'])
            row_dict['actual_guest_count'] = float(predicted_guest_count)
            row_dict['day_of_week'] = float(dow)
            row_dict['month'] = float(month)
            row_dict['is_weekend'] = float(is_weekend)
            row_dict['is_holiday_or_event'] = float(is_event)
            row_dict[f'meal_{meal_type}'] = 1.0
            row_dict[f'cat_{food_item["category"]}'] = 1.0

            x_vec = [row_dict.get(feat, 0.0) for feat in feature_names]
            raw_qty = predict_forest(trees, x_vec)
            if raw_qty > 0:
                base_estimated_quantity = round(float(raw_qty), 2)
        except Exception as e:
            print(f"[Predictor] Food model inference failed: {e}. Using per-guest formula.")

    if base_estimated_quantity is None or base_estimated_quantity <= 0:
        food_method = "Historical Per-Guest Consumption Average"
        base_estimated_quantity = round(
            predicted_guest_count * float(food_item['default_consumption_per_guest']), 2
        )

    # -- Apply safety buffer --
    buffer_quantity = round(base_estimated_quantity * (safety_buffer_percent / 100.0), 2)
    recommended_food_quantity = round(base_estimated_quantity + buffer_quantity, 2)
    combined_method = f"{guest_method} + {food_method}"
    notes = (
        f"Service: {meal_type} | Base: {base_estimated_quantity} {food_item['unit']} "
        f"| Buffer: +{safety_buffer_percent}%"
    )

    # -- Persist prediction to DB --
    cursor.execute('''
        INSERT INTO predictions
        (hotel_id, prediction_date, meal_type, food_item_id, predicted_guest_count,
         base_estimated_quantity, safety_buffer_percent, recommended_food_quantity,
         unit, prediction_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        hotel['id'], date_str, meal_type, food_item['id'],
        predicted_guest_count, base_estimated_quantity,
        safety_buffer_percent, recommended_food_quantity,
        food_item['unit'], combined_method, notes
    ))
    prediction_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "id": prediction_id,
        "hotel_id": hotel['id'],
        "hotel_name": hotel['name'],
        "prediction_date": date_str,
        "meal_type": meal_type,
        "food_item_id": food_item['id'],
        "food_item_name": food_item['name'],
        "food_category": food_item['category'],
        "unit": food_item['unit'],
        "predicted_guest_count": predicted_guest_count,
        "base_estimated_quantity": base_estimated_quantity,
        "safety_buffer_percent": safety_buffer_percent,
        "safety_buffer_quantity": buffer_quantity,
        "recommended_food_quantity": recommended_food_quantity,
        "prediction_method": combined_method,
        "is_holiday_or_event": bool(is_event),
        "notes": notes,
        "created_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
