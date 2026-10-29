import json
import os
from flask import Blueprint, jsonify
from database import get_db_connection
from config import Config
from models.ml_pipeline import train_all_models

GUEST_MODEL_PATH = os.path.join(Config.MODELS_DIR, 'guest_count_model.json')
FOOD_MODEL_PATH  = os.path.join(Config.MODELS_DIR, 'food_quantity_model.json')

models_bp = Blueprint('models', __name__)


def _parse_fi(row_dict):
    """Parse feature_importances JSON field safely."""
    try:
        row_dict['feature_importances'] = json.loads(row_dict.get('feature_importances') or '{}')
    except Exception:
        row_dict['feature_importances'] = {}
    return row_dict


@models_bp.route('/metrics', methods=['GET'])
def get_model_metrics():
    conn = get_db_connection()
    cursor = conn.cursor()

    guest_model_exists = os.path.exists(GUEST_MODEL_PATH)
    food_model_exists  = os.path.exists(FOOD_MODEL_PATH)

    guest_row = cursor.execute(
        "SELECT * FROM model_metrics WHERE model_name = 'guest_count_predictor' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    food_row = cursor.execute(
        "SELECT * FROM model_metrics WHERE model_name = 'food_quantity_predictor' ORDER BY id DESC LIMIT 1"
    ).fetchone()

    total_records = cursor.execute("SELECT COUNT(*) FROM historical_records").fetchone()[0]
    conn.close()

    guest_metrics = _parse_fi(dict(guest_row)) if guest_row else None
    food_metrics  = _parse_fi(dict(food_row))  if food_row  else None

    return jsonify({
        "success": True,
        "data": {
            "is_trained": bool(guest_model_exists and food_model_exists),
            "guest_model_loaded": guest_model_exists,
            "food_model_loaded":  food_model_exists,
            "total_training_records_available": total_records,
            "guest_count_model":   guest_metrics,
            "food_quantity_model": food_metrics
        }
    })


@models_bp.route('/train', methods=['POST'])
def trigger_training():
    try:
        results = train_all_models()
        if not results.get('success'):
            return jsonify(results), 400
        return jsonify(results)
    except Exception as e:
        return jsonify({"success": False, "error": f"Training failed: {str(e)}"}), 500


@models_bp.route('/train-xgboost', methods=['POST'])
def train_xgboost_models():
    """Train XGBoost models for RF vs XGBoost comparison."""
    try:
        from models.xgb_pipeline import train_all_xgb, XGB_AVAILABLE
        if not XGB_AVAILABLE:
            return jsonify({"success": False, "error": "XGBoost not installed. Run: pip install xgboost"}), 400
        result = train_all_xgb()
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@models_bp.route('/train-all', methods=['POST'])
def train_all():
    """Train both RF and XGBoost models in sequence."""
    try:
        rf_res = train_all_models()
        try:
            from models.xgb_pipeline import train_all_xgb
            xgb_res = train_all_xgb()
        except Exception as xe:
            xgb_res = {"success": False, "error": str(xe)}
        return jsonify({
            "success": True,
            "random_forest": rf_res,
            "xgboost": xgb_res
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@models_bp.route('/comparison', methods=['GET'])
def model_comparison():
    """Return the latest RF vs XGBoost metrics for both prediction targets."""
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT model_name, algorithm, algorithm_key, training_date, dataset_size,
               train_size, test_size, mae, rmse, r2_score, mape, target_variable, is_reliable
        FROM model_metrics
        WHERE id IN (
            SELECT MAX(id) FROM model_metrics GROUP BY model_name
        )
        ORDER BY model_name, algorithm_key
    ''').fetchall()
    conn.close()

    comparison = [dict(r) for r in rows]

    # Identify best model per target based on lowest RMSE
    targets = {}
    for row in comparison:
        tvar = 'guest' if 'guest' in row['model_name'] else 'food'
        if tvar not in targets:
            targets[tvar] = row
        elif row['rmse'] < targets[tvar]['rmse']:
            targets[tvar] = row

    best = {k: v['model_name'] for k, v in targets.items()}

    return jsonify({
        "success": True,
        "comparison": comparison,
        "best_models": best,
        "selection_criterion": "Lowest RMSE on 20% hold-out test set"
    })
