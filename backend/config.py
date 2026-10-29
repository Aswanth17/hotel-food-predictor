import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'hotel-food-predictor-secret-key-2026-secure')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-hotel-secret-2026-xyz')
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours in seconds
    DATABASE = os.environ.get('DATABASE_PATH', os.path.join(BASE_DIR, 'hotel_food_predictor.db'))
    MODELS_DIR = os.path.join(BASE_DIR, 'data', 'saved_models')
    SAMPLE_DATA_DIR = os.path.join(BASE_DIR, 'data')
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB max upload
    DEFAULT_SAFETY_BUFFER = 5.0
    ALLOWED_EXTENSIONS = {'csv'}

os.makedirs(Config.MODELS_DIR, exist_ok=True)
os.makedirs(Config.SAMPLE_DATA_DIR, exist_ok=True)
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
