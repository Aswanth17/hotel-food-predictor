-- ==============================================================================
-- Supabase (PostgreSQL) Database Schema for Hotel Food Predictor
-- Run this in the Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==============================================================================

-- 1. Hotels table
CREATE TABLE IF NOT EXISTS hotels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    total_rooms INTEGER NOT NULL DEFAULT 100,
    star_rating INTEGER NOT NULL DEFAULT 4,
    dining_capacity INTEGER NOT NULL DEFAULT 150,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Food Items catalogue
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL CHECK(unit IN ('kg', 'litres', 'pieces')),
    default_consumption_per_guest NUMERIC(10,3) NOT NULL,
    cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    shelf_life_days INTEGER NOT NULL DEFAULT 2,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Hotel Accounts (Multi-Tenant Authentication)
CREATE TABLE IF NOT EXISTS hotel_accounts (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL UNIQUE REFERENCES hotels(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Admin Accounts
CREATE TABLE IF NOT EXISTS admin_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'System Administrator',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Hotel-specific Events (Private per hotel)
CREATE TABLE IF NOT EXISTS hotel_events (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_end_date DATE,
    event_category VARCHAR(100) NOT NULL DEFAULT 'Special Hotel Event',
    description TEXT,
    expected_guest_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Public Holidays Shared Calendar
CREATE TABLE IF NOT EXISTS public_holidays (
    id SERIAL PRIMARY KEY,
    holiday_name VARCHAR(255) NOT NULL,
    holiday_date DATE NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL DEFAULT 'Public Holiday',
    country VARCHAR(10) DEFAULT 'IN',
    description TEXT
);

-- 7. Historical Records
CREATE TABLE IF NOT EXISTS historical_records (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    meal_type VARCHAR(50) NOT NULL CHECK(meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    actual_guest_count INTEGER NOT NULL CHECK(actual_guest_count >= 0),
    actual_quantity_consumed NUMERIC(10,2) NOT NULL CHECK(actual_quantity_consumed >= 0),
    actual_quantity_prepared NUMERIC(10,2),
    waste_quantity NUMERIC(10,2),
    occupancy_rate NUMERIC(5,2),
    day_of_week INTEGER,
    is_weekend INTEGER DEFAULT 0,
    is_holiday_or_event INTEGER DEFAULT 0,
    season VARCHAR(50),
    source_type VARCHAR(100) DEFAULT 'synthetic_demonstration',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_hotel_date_meal_item 
ON historical_records (hotel_id, record_date, meal_type, food_item_id);

-- 8. Predictions History
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    meal_type VARCHAR(50) NOT NULL,
    food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
    predicted_guest_count INTEGER NOT NULL,
    base_estimated_quantity NUMERIC(10,2) NOT NULL,
    safety_buffer_percent NUMERIC(5,2) NOT NULL DEFAULT 5.0,
    recommended_food_quantity NUMERIC(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    prediction_method VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. ML Model Metrics
CREATE TABLE IF NOT EXISTS model_metrics (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    algorithm VARCHAR(255) NOT NULL,
    algorithm_key VARCHAR(100) DEFAULT 'random_forest',
    training_date TIMESTAMP WITH TIME ZONE NOT NULL,
    dataset_size INTEGER NOT NULL,
    train_size INTEGER NOT NULL,
    test_size INTEGER NOT NULL,
    mae NUMERIC(10,2) NOT NULL,
    rmse NUMERIC(10,2) NOT NULL,
    r2_score NUMERIC(10,4) NOT NULL,
    mape NUMERIC(10,2),
    feature_importances TEXT,
    target_variable VARCHAR(255) NOT NULL,
    is_reliable INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Settings table
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

-- ==============================================================================
-- Initial Seed Data: Hotels & Demo Accounts
-- ==============================================================================

-- Seed Hotels
INSERT INTO hotels (id, name, city, total_rooms, star_rating, dining_capacity, contact_email, contact_phone) VALUES
(1, 'The Grand Horizon Palace', 'Metro City', 220, 5, 300, 'concierge@grandhorizon.com', '+1-555-0101'),
(2, 'Royal Palm Resort & Spa', 'Coastal Beach', 180, 5, 250, 'reservations@royalpalm.com', '+1-555-0102'),
(3, 'Highland View Heritage Inn', 'Hill Station', 90, 4, 120, 'manager@highlandinn.com', '+1-555-0103'),
(4, 'Azure Bay Business Hotel', 'Financial District', 140, 4, 180, 'frontdesk@azurebay.com', '+1-555-0104'),
(5, 'Sapphire Suites & Convention', 'Airport Hub', 200, 4, 260, 'events@sapphiresuites.com', '+1-555-0105')
ON CONFLICT (id) DO NOTHING;

-- Seed Hotel Accounts (password123 bcrypt hash)
INSERT INTO hotel_accounts (hotel_id, email, password_hash, is_active) VALUES
(1, 'grand@hotel.com', '$2b$12$VwZ230zO8Y8/kHj6YqQW.u8P0b2R4.x8m5r9v6Y9a0b1c2d3e4f5a', 1),
(2, 'royalpalm@hotel.com', '$2b$12$VwZ230zO8Y8/kHj6YqQW.u8P0b2R4.x8m5r9v6Y9a0b1c2d3e4f5a', 1),
(3, 'highland@hotel.com', '$2b$12$VwZ230zO8Y8/kHj6YqQW.u8P0b2R4.x8m5r9v6Y9a0b1c2d3e4f5a', 1),
(4, 'azurebay@hotel.com', '$2b$12$VwZ230zO8Y8/kHj6YqQW.u8P0b2R4.x8m5r9v6Y9a0b1c2d3e4f5a', 1),
(5, 'sapphire@hotel.com', '$2b$12$VwZ230zO8Y8/kHj6YqQW.u8P0b2R4.x8m5r9v6Y9a0b1c2d3e4f5a', 1)
ON CONFLICT (email) DO NOTHING;

-- Seed Admin Account (admin123 bcrypt hash)
INSERT INTO admin_accounts (email, password_hash, name) VALUES
('admin@hotelpredictor.com', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'System Administrator')
ON CONFLICT (email) DO NOTHING;

-- Seed Public Holidays
INSERT INTO public_holidays (holiday_name, holiday_date, category, country, description) VALUES
('New Year''s Day',   '2026-01-01', 'Public Holiday', 'IN', 'New Year celebration'),
('Republic Day',     '2026-01-26', 'Public Holiday', 'IN', 'Indian Republic Day'),
('Holi',             '2026-03-21', 'Festival',       'IN', 'Festival of Colors'),
('Good Friday',      '2026-04-03', 'Public Holiday', 'IN', 'Good Friday'),
('Eid ul-Fitr',      '2026-04-02', 'Festival',       'IN', 'End of Ramadan'),
('Independence Day', '2026-08-15', 'Public Holiday', 'IN', 'Indian Independence Day'),
('Gandhi Jayanti',   '2026-10-02', 'Public Holiday', 'IN', 'Gandhi''s Birthday'),
('Dussehra',         '2026-10-22', 'Festival',       'IN', 'Victory of good over evil'),
('Diwali',           '2026-11-08', 'Festival',       'IN', 'Festival of Lights'),
('Christmas',        '2026-12-25', 'Public Holiday', 'IN', 'Christmas Day'),
('New Year''s Eve',  '2026-12-31', 'Festival',       'IN', 'New Year Eve celebration')
ON CONFLICT (holiday_date) DO NOTHING;
