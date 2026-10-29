export interface Hotel {
  id: number;
  name: string;
  city: string;
  total_rooms: number;
  star_rating: number;
  dining_capacity: number;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  historical_record_count?: number;
}

export interface FoodItem {
  id: number;
  name: string;
  category: string;
  unit: 'kg' | 'litres' | 'pieces';
  default_consumption_per_guest: number;
  cost_per_unit: number;
  shelf_life_days: number;
  is_active: number;
  avg_consumption?: number;
  record_count?: number;
  created_at: string;
}

export interface Prediction {
  id: number;
  hotel_id: number;
  hotel_name?: string;
  prediction_date: string;
  meal_type: 'Breakfast' | 'Lunch' | 'Dinner';
  food_item_id: number;
  food_item_name?: string;
  food_category?: string;
  predicted_guest_count: number;
  base_estimated_quantity: number;
  safety_buffer_percent: number;
  safety_buffer_quantity?: number;
  recommended_food_quantity: number;
  unit: 'kg' | 'litres' | 'pieces';
  prediction_method: string;
  is_holiday_or_event?: boolean;
  notes?: string;
  created_at: string;
}

export interface HistoricalRecord {
  id: number;
  hotel_id: number;
  hotel_name: string;
  record_date: string;
  meal_type: 'Breakfast' | 'Lunch' | 'Dinner';
  food_item_id: number;
  food_item_name: string;
  food_category: string;
  unit: 'kg' | 'litres' | 'pieces';
  actual_guest_count: number;
  actual_quantity_consumed: number;
  actual_quantity_prepared?: number;
  waste_quantity?: number;
  occupancy_rate?: number;
  is_weekend: number;
  is_holiday_or_event: number;
  season: string;
  source_type: string;
  created_at: string;
}

export interface ModelMetric {
  id: number;
  model_name: string;
  algorithm: string;
  training_date: string;
  dataset_size: number;
  train_size: number;
  test_size: number;
  mae: number;
  rmse: number;
  r2_score: number;
  feature_importances: Record<string, number>;
  target_variable: string;
  is_reliable: number;
}

export interface DashboardStats {
  total_hotels: number;
  total_food_items: number;
  total_historical_records: number;
  total_predictions: number;
  recent_predictions: Prediction[];
  guest_trends: {
    record_date: string;
    avg_guest_count: number;
    max_guest_count: number;
    min_guest_count: number;
  }[];
  meal_distribution: {
    meal_type: string;
    avg_guests: number;
    service_days: number;
  }[];
  top_food_items: {
    name: string;
    category: string;
    unit: string;
    total_consumed: number;
    avg_per_service: number;
  }[];
}

export interface CSVPreviewResult {
  detected_headers: string[];
  total_rows_inspected: number;
  valid_rows_count: number;
  duplicate_rows_count: number;
  invalid_rows_count: number;
  preview_rows: {
    row_number: number;
    hotel_name: string;
    record_date: string;
    meal_type: string;
    food_item_name: string;
    actual_guest_count: string;
    actual_quantity_consumed: string;
    unit: string;
    status: 'valid' | 'duplicate_in_db' | 'duplicate_in_file' | 'invalid';
    issues: string[];
  }[];
  validation_errors: { row: number; issues: string[] }[];
}

export interface CSVImportResult {
  total_rows_processed: number;
  imported_records: number;
  updated_records: number;
  skipped_duplicates: number;
  invalid_discarded_records: number;
  deduplication_strategy_used: string;
  sample_discarded_issues: string[];
}
