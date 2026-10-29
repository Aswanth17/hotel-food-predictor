import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import timedelta

from config import Config
from database import init_db, seed_initial_data_if_empty
from routes.dashboard import dashboard_bp
from routes.hotels import hotels_bp
from routes.food_items import food_items_bp
from routes.predictions import predictions_bp
from routes.historical import historical_bp
from routes.models_api import models_bp
from routes.reports import reports_bp
from routes.settings import settings_bp
from routes.auth import auth_bp
from routes.hotel_events import events_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(seconds=Config.JWT_ACCESS_TOKEN_EXPIRES)

    # CORS — allow Authorization header from the Vite dev server
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # JWT setup
    jwt = JWTManager(app)

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({"success": False, "error": "Authentication required", "reason": reason}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({"success": False, "error": "Invalid token", "reason": reason}), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_data):
        return jsonify({"success": False, "error": "Token has expired. Please log in again."}), 401

    # DB init
    init_db()
    seed_initial_data_if_empty()

    # Health check (public)
    @app.route('/api/health', methods=['GET'])
    def health():
        from models.ml_pipeline import GUEST_MODEL_PATH, FOOD_MODEL_PATH
        from models.xgb_pipeline import XGB_GUEST_MODEL_PATH, XGB_FOOD_MODEL_PATH, XGB_AVAILABLE
        return jsonify({
            "status": "healthy",
            "service": "Food Provision Requirement Predictor for Hotels API",
            "version": "2.0.0",
            "database_connected": os.path.exists(Config.DATABASE),
            "models": {
                "guest_count_model_present":     os.path.exists(GUEST_MODEL_PATH),
                "food_quantity_model_present":   os.path.exists(FOOD_MODEL_PATH),
                "xgb_guest_model_present":       os.path.exists(XGB_GUEST_MODEL_PATH),
                "xgb_food_model_present":        os.path.exists(XGB_FOOD_MODEL_PATH),
                "xgboost_available":             XGB_AVAILABLE,
            }
        })

    # Blueprints
    app.register_blueprint(auth_bp,        url_prefix='/api/auth')
    app.register_blueprint(events_bp,      url_prefix='/api/events')
    app.register_blueprint(dashboard_bp,   url_prefix='/api/dashboard')
    app.register_blueprint(hotels_bp,      url_prefix='/api/hotels')
    app.register_blueprint(food_items_bp,  url_prefix='/api/food-items')
    app.register_blueprint(predictions_bp, url_prefix='/api/predictions')
    app.register_blueprint(historical_bp,  url_prefix='/api/historical')
    app.register_blueprint(models_bp,      url_prefix='/api/models')
    app.register_blueprint(reports_bp,     url_prefix='/api/reports')
    app.register_blueprint(settings_bp,    url_prefix='/api/settings')

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"success": False, "error": str(e)}), 400

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"success": False, "error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
