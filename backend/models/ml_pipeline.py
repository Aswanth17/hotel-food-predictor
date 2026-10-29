import os
import sys
import json
import math
import random
from datetime import datetime

# Ensure backend root is on the path so 'config' and 'database' can be imported
# whether this file is run directly from models/ or invoked from app.py
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)
from config import Config
from database import get_db_connection

GUEST_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'guest_count_model.json')
FOOD_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'food_quantity_model.json')

# Check if scikit-learn and pandas can be loaded safely
SKLEARN_AVAILABLE = False
try:
    import pandas as pd
    import numpy as np
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    import joblib
    SKLEARN_AVAILABLE = True
except Exception as e:
    SKLEARN_AVAILABLE = False
    print(f"Note: Standard scikit-learn binary loading unavailable in this environment ({e}). Using pure-Python resilient regression engine.")

# -------------------------------------------------------------
# Pure Python Mathematical Regression Engine (AppLocker-Safe)
# -------------------------------------------------------------
class PureDecisionTreeRegressor:
    """A pure-Python Regression Tree with variance-reduction splitting."""
    def __init__(self, max_depth=5, min_samples_split=6):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.tree = None

    def fit(self, X, y):
        self.tree = self._build_tree(X, y, depth=0)

    def _variance(self, y):
        if len(y) <= 1:
            return 0.0
        mean = sum(y) / len(y)
        return sum((val - mean) ** 2 for val in y) / len(y)

    def _build_tree(self, X, y, depth):
        num_samples = len(y)
        if num_samples == 0:
            return {'val': 0.0}

        mean_val = sum(y) / num_samples

        if depth >= self.max_depth or num_samples < self.min_samples_split:
            return {'val': mean_val}

        best_feat = None
        best_thresh = None
        best_var_reduction = 0.0
        current_var = self._variance(y)

        num_features = len(X[0])
        # Random feature sampling (Random Forest style)
        features_to_check = random.sample(range(num_features), max(1, int(math.sqrt(num_features))))

        for feat_idx in features_to_check:
            values = sorted(set(row[feat_idx] for row in X))
            if len(values) <= 1:
                continue

            # Evaluate split points
            for i in range(len(values) - 1):
                thresh = (values[i] + values[i+1]) / 2.0
                left_y = [y[j] for j in range(num_samples) if X[j][feat_idx] <= thresh]
                right_y = [y[j] for j in range(num_samples) if X[j][feat_idx] > thresh]

                if not left_y or not right_y:
                    continue

                var_reduction = current_var - (
                    (len(left_y) / num_samples) * self._variance(left_y) +
                    (len(right_y) / num_samples) * self._variance(right_y)
                )

                if var_reduction > best_var_reduction:
                    best_var_reduction = var_reduction
                    best_feat = feat_idx
                    best_thresh = thresh

        if best_feat is None or best_var_reduction <= 0:
            return {'val': mean_val}

        left_X, left_y = [], []
        right_X, right_y = [], []
        for j in range(num_samples):
            if X[j][best_feat] <= best_thresh:
                left_X.append(X[j])
                left_y.append(y[j])
            else:
                right_X.append(X[j])
                right_y.append(y[j])

        return {
            'feat': best_feat,
            'thresh': best_thresh,
            'var_reduction': best_var_reduction,
            'left': self._build_tree(left_X, left_y, depth + 1),
            'right': self._build_tree(right_X, right_y, depth + 1)
        }

    def predict_one(self, node, x):
        if 'val' in node:
            return node['val']
        if x[node['feat']] <= node['thresh']:
            return self.predict_one(node['left'], x)
        else:
            return self.predict_one(node['right'], x)

    def predict(self, X):
        return [self.predict_one(self.tree, row) for row in X]

class PureRandomForestRegressor:
    """Ensemble of Pure Decision Trees with feature importances."""
    def __init__(self, n_estimators=15, max_depth=6, min_samples_split=6):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.trees = []
        self.feature_importances_ = {}

    def fit(self, X, y, feature_names):
        random.seed(42)
        n = len(X)
        self.trees = []
        feat_importance_sums = {i: 0.0 for i in range(len(feature_names))}

        for _ in range(self.n_estimators):
            # Bootstrap sample
            indices = [random.randint(0, n - 1) for _ in range(n)]
            b_X = [X[i] for i in indices]
            b_y = [y[i] for i in indices]

            tree = PureDecisionTreeRegressor(max_depth=self.max_depth, min_samples_split=self.min_samples_split)
            tree.fit(b_X, b_y)
            self.trees.append(tree)

            # Accumulate variance reduction for importances
            self._accumulate_importances(tree.tree, feat_importance_sums)

        # Normalize importances
        total_imp = sum(feat_importance_sums.values())
        if total_imp > 0:
            self.feature_importances_ = {
                feature_names[i]: round(feat_importance_sums[i] / total_imp, 4)
                for i in range(len(feature_names))
            }
        else:
            self.feature_importances_ = {name: round(1.0 / len(feature_names), 4) for name in feature_names}

    def _accumulate_importances(self, node, sums):
        if not node or 'val' in node:
            return
        sums[node['feat']] += node.get('var_reduction', 0.0)
        self._accumulate_importances(node['left'], sums)
        self._accumulate_importances(node['right'], sums)

    def predict(self, X):
        predictions_matrix = [tree.predict(X) for tree in self.trees]
        num_samples = len(X)
        avg_predictions = []
        for i in range(num_samples):
            avg_predictions.append(sum(predictions_matrix[t][i] for t in range(self.n_estimators)) / self.n_estimators)
        return avg_predictions

    def to_dict(self):
        return {
            'trees': [t.tree for t in self.trees],
            'feature_importances': self.feature_importances_
        }

    @classmethod
    def from_dict(cls, data):
        forest = cls()
        forest.feature_importances_ = data.get('feature_importances', {})
        forest.trees = []
        for t_dict in data.get('trees', []):
            t = PureDecisionTreeRegressor()
            t.tree = t_dict
            forest.trees.append(t)
        return forest


# -------------------------------------------------------------
# Training and Evaluation Logic
# -------------------------------------------------------------

def calculate_metrics(y_true, y_pred):
    """Calculates authentic MAE, RMSE, and R2 score."""
    n = len(y_true)
    if n == 0:
        return 0.0, 0.0, 0.0
    mae = sum(abs(y_true[i] - y_pred[i]) for i in range(n)) / n
    mse = sum((y_true[i] - y_pred[i]) ** 2 for i in range(n)) / n
    rmse = math.sqrt(mse)

    mean_y = sum(y_true) / n
    ss_tot = sum((y_true[i] - mean_y) ** 2 for i in range(n))
    ss_res = sum((y_true[i] - y_pred[i]) ** 2 for i in range(n))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    return round(mae, 2), round(rmse, 2), round(r2, 4)

def load_data_from_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            hr.id,
            hr.hotel_id,
            h.dining_capacity,
            h.star_rating,
            hr.record_date,
            hr.meal_type,
            hr.food_item_id,
            fi.category as food_category,
            fi.unit,
            fi.default_consumption_per_guest,
            hr.actual_guest_count,
            hr.actual_quantity_consumed,
            hr.actual_quantity_prepared,
            hr.waste_quantity,
            hr.occupancy_rate,
            hr.day_of_week,
            hr.is_weekend,
            hr.is_holiday_or_event,
            hr.season
        FROM historical_records hr
        JOIN hotels h ON hr.hotel_id = h.id
        JOIN food_items fi ON hr.food_item_id = fi.id
    ''')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def train_guest_count_model():
    """
    Trains guest count prediction model using strictly pre-service features.
    Prevents target leakage by excluding food consumption or waste.
    """
    records = load_data_from_db()
    if len(records) < 20:
        return {"success": False, "error": f"Insufficient dataset size ({len(records)} records)."}

    # Deduplicate to distinct service events (one guest count per hotel, date, meal)
    seen_services = set()
    service_rows = []
    for r in records:
        key = (r['hotel_id'], r['record_date'], r['meal_type'])
        if key not in seen_services:
            seen_services.add(key)
            service_rows.append(r)

    feature_names = [
        'dining_capacity', 'star_rating', 'day_of_week', 'month', 'is_weekend', 
        'is_holiday_or_event', 'meal_Breakfast', 'meal_Lunch', 'meal_Dinner', 
        'season_Winter', 'season_Spring', 'season_Summer', 'season_Autumn'
    ]

    X = []
    y = []

    for r in service_rows:
        dt = datetime.strptime(r['record_date'], '%Y-%m-%d')
        month = dt.month
        meal = r['meal_type']
        season = r['season']

        row = [
            float(r['dining_capacity']),
            float(r['star_rating']),
            float(r['day_of_week']),
            float(month),
            float(r['is_weekend']),
            float(r['is_holiday_or_event']),
            1.0 if meal == 'Breakfast' else 0.0,
            1.0 if meal == 'Lunch' else 0.0,
            1.0 if meal == 'Dinner' else 0.0,
            1.0 if season == 'Winter' else 0.0,
            1.0 if season == 'Spring' else 0.0,
            1.0 if season == 'Summer' else 0.0,
            1.0 if season == 'Autumn' else 0.0
        ]
        X.append(row)
        y.append(float(r['actual_guest_count']))

    # Train / Test split (80% train, 20% holdout test)
    random.seed(42)
    indices = list(range(len(X)))
    random.shuffle(indices)
    split_idx = int(len(X) * 0.80)

    train_idx = indices[:split_idx]
    test_idx = indices[split_idx:]

    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_test = [X[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    # Train Random Forest Regressor
    model = PureRandomForestRegressor(n_estimators=15, max_depth=6, min_samples_split=6)
    model.fit(X_train, y_train, feature_names)

    # Evaluate on test set
    y_pred = model.predict(X_test)
    mae, rmse, r2 = calculate_metrics(y_test, y_pred)
    is_reliable = 1 if r2 >= 0.0 else 0

    # Save model artifact to disk
    model_payload = {
        'model_name': 'guest_count_predictor',
        'algorithm': 'Random Forest Regressor (Ensemble)',
        'feature_names': feature_names,
        'metrics': {'mae': mae, 'rmse': rmse, 'r2': r2},
        'feature_importances': model.feature_importances_,
        'forest': model.to_dict(),
        'trained_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    with open(GUEST_MODEL_PATH, 'w') as f:
        json.dump(model_payload, f)

    # Store metrics in SQLite database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO model_metrics 
        (model_name, algorithm, training_date, dataset_size, train_size, test_size, mae, rmse, r2_score, feature_importances, target_variable, is_reliable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'guest_count_predictor',
        'RandomForestRegressor (15 Estimators, Depth=6)',
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        len(service_rows),
        len(X_train),
        len(X_test),
        mae,
        rmse,
        r2,
        json.dumps(model.feature_importances_),
        'actual_guest_count (Headcount)',
        is_reliable
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "model_name": "guest_count_predictor",
        "dataset_size": len(service_rows),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "mae": mae,
        "rmse": rmse,
        "r2_score": r2,
        "is_reliable": bool(is_reliable),
        "feature_importances": model.feature_importances_
    }

def train_food_quantity_model():
    """
    Trains food quantity prediction model using hotel, item, guest count, and calendar features.
    """
    records = load_data_from_db()
    if len(records) < 30:
        return {"success": False, "error": f"Insufficient dataset size ({len(records)} records)."}

    # Use a sample of up to 1000 records for fast, balanced training
    random.seed(42)
    sample_records = random.sample(records, min(1000, len(records)))

    categories = list(set(r['food_category'] for r in sample_records))
    feature_names = [
        'dining_capacity', 'default_consumption_per_guest', 'actual_guest_count',
        'day_of_week', 'month', 'is_weekend', 'is_holiday_or_event',
        'meal_Breakfast', 'meal_Lunch', 'meal_Dinner'
    ] + [f"cat_{c}" for c in categories]

    X = []
    y = []

    for r in sample_records:
        dt = datetime.strptime(r['record_date'], '%Y-%m-%d')
        month = dt.month
        meal = r['meal_type']

        row = [
            float(r['dining_capacity']),
            float(r['default_consumption_per_guest']),
            float(r['actual_guest_count']),
            float(r['day_of_week']),
            float(month),
            float(r['is_weekend']),
            float(r['is_holiday_or_event']),
            1.0 if meal == 'Breakfast' else 0.0,
            1.0 if meal == 'Lunch' else 0.0,
            1.0 if meal == 'Dinner' else 0.0
        ]
        for c in categories:
            row.append(1.0 if r['food_category'] == c else 0.0)

        X.append(row)
        y.append(float(r['actual_quantity_consumed']))

    indices = list(range(len(X)))
    random.shuffle(indices)
    split_idx = int(len(X) * 0.80)

    train_idx = indices[:split_idx]
    test_idx = indices[split_idx:]

    X_train = [X[i] for i in train_idx]
    y_train = [y[i] for i in train_idx]
    X_test = [X[i] for i in test_idx]
    y_test = [y[i] for i in test_idx]

    model = PureRandomForestRegressor(n_estimators=15, max_depth=6, min_samples_split=6)
    model.fit(X_train, y_train, feature_names)

    y_pred = model.predict(X_test)
    mae, rmse, r2 = calculate_metrics(y_test, y_pred)
    is_reliable = 1 if r2 >= 0.0 else 0

    model_payload = {
        'model_name': 'food_quantity_predictor',
        'algorithm': 'Random Forest Regressor (Ensemble)',
        'categories': categories,
        'feature_names': feature_names,
        'metrics': {'mae': mae, 'rmse': rmse, 'r2': r2},
        'feature_importances': model.feature_importances_,
        'forest': model.to_dict(),
        'trained_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    with open(FOOD_MODEL_PATH, 'w') as f:
        json.dump(model_payload, f)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO model_metrics 
        (model_name, algorithm, training_date, dataset_size, train_size, test_size, mae, rmse, r2_score, feature_importances, target_variable, is_reliable)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'food_quantity_predictor',
        'RandomForestRegressor (15 Estimators, Depth=6)',
        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        len(sample_records),
        len(X_train),
        len(X_test),
        mae,
        rmse,
        r2,
        json.dumps(model.feature_importances_),
        'actual_quantity_consumed (kg / litres / pieces)',
        is_reliable
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "model_name": "food_quantity_predictor",
        "dataset_size": len(sample_records),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "mae": mae,
        "rmse": rmse,
        "r2_score": r2,
        "is_reliable": bool(is_reliable),
        "feature_importances": model.feature_importances_
    }

def train_all_models():
    """Trains both guest count and food quantity regression models."""
    guest_res = train_guest_count_model()
    food_res = train_food_quantity_model()
    return {
        "success": True,
        "guest_model": guest_res,
        "food_model": food_res,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == '__main__':
    res = train_all_models()
    print("Training Results:")
    print(json.dumps(res, indent=2))
