-- ============================================================================
-- FIFA Nexus AI — Database Seed Script
-- Creates tables and populates with realistic stadium data
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Users & Auth
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'fan' CHECK (role IN ('fan', 'staff', 'admin')),
    preferred_language VARCHAR(5) DEFAULT 'en',
    accessibility_needs TEXT[] DEFAULT '{}',
    is_vip BOOLEAN DEFAULT FALSE,
    supported_team VARCHAR(3),
    seat_section VARCHAR(10),
    seat_row VARCHAR(5),
    seat_number VARCHAR(5),
    seat_level INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Stadium Zones & Nodes (Graph for Wayfinding)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stadium_zones (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    zone_type VARCHAR(30) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    level INTEGER DEFAULT 0,
    is_accessible BOOLEAN DEFAULT TRUE,
    is_vip_only BOOLEAN DEFAULT FALSE,
    capacity INTEGER NOT NULL DEFAULT 500,
    current_occupancy INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zone_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_zone_id VARCHAR(50) REFERENCES stadium_zones(id),
    target_zone_id VARCHAR(50) REFERENCES stadium_zones(id),
    base_cost_seconds DOUBLE PRECISION NOT NULL,
    distance_meters DOUBLE PRECISION NOT NULL,
    is_accessible BOOLEAN DEFAULT TRUE,
    is_vip_only BOOLEAN DEFAULT FALSE,
    has_stairs BOOLEAN DEFAULT FALSE,
    has_elevator BOOLEAN DEFAULT FALSE,
    UNIQUE(source_zone_id, target_zone_id)
);

-- ============================================================================
-- Sensor Data & Predictions
-- ============================================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sensor_id VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(30) NOT NULL,
    zone_id VARCHAR(50) REFERENCES stadium_zones(id),
    payload JSONB NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    batch_id VARCHAR(100)
);

CREATE INDEX idx_sensor_readings_zone ON sensor_readings(zone_id, recorded_at DESC);
CREATE INDEX idx_sensor_readings_type ON sensor_readings(sensor_type, recorded_at DESC);

CREATE TABLE IF NOT EXISTS congestion_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(50) REFERENCES stadium_zones(id),
    current_level VARCHAR(20) NOT NULL,
    predicted_15min VARCHAR(20) NOT NULL,
    predicted_30min VARCHAR(20) NOT NULL,
    current_occupancy INTEGER NOT NULL,
    predicted_occupancy_15min INTEGER NOT NULL,
    predicted_occupancy_30min INTEGER NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    trend_direction VARCHAR(20) NOT NULL,
    trend_rate DOUBLE PRECISION NOT NULL,
    predicted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_predictions_zone ON congestion_predictions(zone_id, predicted_at DESC);

-- ============================================================================
-- Staff Alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    category VARCHAR(30) NOT NULL,
    zone_id VARCHAR(50) REFERENCES stadium_zones(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    staff_required INTEGER DEFAULT 1,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON staff_alerts(status, priority);

-- ============================================================================
-- Translation & Feedback
-- ============================================================================
CREATE TABLE IF NOT EXISTS translation_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_text_hash VARCHAR(64) NOT NULL,
    source_language VARCHAR(5) NOT NULL,
    target_language VARCHAR(5) NOT NULL,
    translated_text TEXT NOT NULL,
    context VARCHAR(50),
    confidence DOUBLE PRECISION DEFAULT 1.0,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_text_hash, source_language, target_language, context)
);

CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    interaction_type VARCHAR(30) NOT NULL,
    interaction_id VARCHAR(100) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Seed Data: Stadium Zones (MetLife Stadium layout)
-- ============================================================================
INSERT INTO stadium_zones (id, name, zone_type, latitude, longitude, level, is_accessible, is_vip_only, capacity) VALUES
    ('gate-a', 'Gate A - Main Entrance', 'entrance', 40.8135, -74.0745, 0, TRUE, FALSE, 2000),
    ('gate-b', 'Gate B - North Entrance', 'entrance', 40.8145, -74.0740, 0, TRUE, FALSE, 1500),
    ('gate-c', 'Gate C - East Entrance', 'entrance', 40.8140, -74.0730, 0, TRUE, FALSE, 1500),
    ('gate-d', 'Gate D - VIP Entrance', 'entrance', 40.8130, -74.0735, 0, TRUE, TRUE, 500),
    ('concourse-100', 'Lower Concourse Section 100', 'concourse', 40.8137, -74.0742, 1, TRUE, FALSE, 3000),
    ('concourse-200', 'Upper Concourse Section 200', 'concourse', 40.8137, -74.0742, 2, TRUE, FALSE, 2500),
    ('concourse-300', 'Premium Concourse', 'concourse', 40.8137, -74.0742, 3, TRUE, TRUE, 1000),
    ('seating-101', 'Section 101 - Lower Bowl', 'seating', 40.8136, -74.0744, 1, TRUE, FALSE, 800),
    ('seating-201', 'Section 201 - Upper Bowl', 'seating', 40.8136, -74.0744, 2, TRUE, FALSE, 600),
    ('seating-vip', 'VIP Suite Level', 'seating', 40.8136, -74.0744, 3, TRUE, TRUE, 200),
    ('food-court-1', 'Main Food Court', 'concession', 40.8138, -74.0743, 1, TRUE, FALSE, 400),
    ('food-court-2', 'Upper Level Food Court', 'concession', 40.8138, -74.0743, 2, TRUE, FALSE, 300),
    ('food-vip', 'VIP Dining', 'concession', 40.8138, -74.0743, 3, TRUE, TRUE, 100),
    ('restroom-l1', 'Lower Level Restrooms', 'restroom', 40.8139, -74.0741, 1, TRUE, FALSE, 100),
    ('restroom-l2', 'Upper Level Restrooms', 'restroom', 40.8139, -74.0741, 2, TRUE, FALSE, 80),
    ('merch-main', 'FIFA Official Store', 'merchandise', 40.8134, -74.0746, 0, TRUE, FALSE, 300),
    ('merch-team', 'Team Merchandise Shop', 'merchandise', 40.8134, -74.0746, 1, TRUE, FALSE, 200),
    ('medical-1', 'Medical Station Alpha', 'medical', 40.8141, -74.0738, 0, TRUE, FALSE, 50),
    ('medical-2', 'Medical Station Beta', 'medical', 40.8141, -74.0738, 2, TRUE, FALSE, 50),
    ('exit-north', 'North Exit', 'exit', 40.8146, -74.0740, 0, TRUE, FALSE, 2000),
    ('exit-south', 'South Exit', 'exit', 40.8128, -74.0740, 0, TRUE, FALSE, 2000),
    ('parking-a', 'Parking Lot A', 'parking', 40.8150, -74.0750, 0, TRUE, FALSE, 5000),
    ('media-center', 'Media Press Center', 'media', 40.8133, -74.0738, 1, TRUE, FALSE, 200)
ON CONFLICT (id) DO NOTHING;

-- Seed Data: Zone Connections (bidirectional paths)
INSERT INTO zone_connections (source_zone_id, target_zone_id, base_cost_seconds, distance_meters, is_accessible, is_vip_only, has_stairs, has_elevator) VALUES
    ('gate-a', 'concourse-100', 30, 50, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'gate-a', 30, 50, TRUE, FALSE, FALSE, FALSE),
    ('gate-b', 'concourse-100', 35, 60, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'gate-b', 35, 60, TRUE, FALSE, FALSE, FALSE),
    ('gate-c', 'concourse-100', 40, 70, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'gate-c', 40, 70, TRUE, FALSE, FALSE, FALSE),
    ('gate-d', 'concourse-300', 20, 30, TRUE, TRUE, FALSE, TRUE),
    ('concourse-300', 'gate-d', 20, 30, TRUE, TRUE, FALSE, TRUE),
    ('concourse-100', 'concourse-200', 60, 20, TRUE, FALSE, TRUE, TRUE),
    ('concourse-200', 'concourse-100', 60, 20, TRUE, FALSE, TRUE, TRUE),
    ('concourse-200', 'concourse-300', 45, 15, TRUE, TRUE, TRUE, TRUE),
    ('concourse-300', 'concourse-200', 45, 15, TRUE, TRUE, TRUE, TRUE),
    ('concourse-100', 'seating-101', 45, 40, TRUE, FALSE, TRUE, FALSE),
    ('seating-101', 'concourse-100', 45, 40, TRUE, FALSE, TRUE, FALSE),
    ('concourse-200', 'seating-201', 40, 35, TRUE, FALSE, TRUE, FALSE),
    ('seating-201', 'concourse-200', 40, 35, TRUE, FALSE, TRUE, FALSE),
    ('concourse-300', 'seating-vip', 20, 15, TRUE, TRUE, FALSE, TRUE),
    ('seating-vip', 'concourse-300', 20, 15, TRUE, TRUE, FALSE, TRUE),
    ('concourse-100', 'food-court-1', 25, 30, TRUE, FALSE, FALSE, FALSE),
    ('food-court-1', 'concourse-100', 25, 30, TRUE, FALSE, FALSE, FALSE),
    ('concourse-200', 'food-court-2', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('food-court-2', 'concourse-200', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('concourse-300', 'food-vip', 15, 20, TRUE, TRUE, FALSE, FALSE),
    ('food-vip', 'concourse-300', 15, 20, TRUE, TRUE, FALSE, FALSE),
    ('concourse-100', 'restroom-l1', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('restroom-l1', 'concourse-100', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('concourse-200', 'restroom-l2', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('restroom-l2', 'concourse-200', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('gate-a', 'merch-main', 15, 20, TRUE, FALSE, FALSE, FALSE),
    ('merch-main', 'gate-a', 15, 20, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'merch-team', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('merch-team', 'concourse-100', 20, 25, TRUE, FALSE, FALSE, FALSE),
    ('gate-a', 'medical-1', 45, 60, TRUE, FALSE, FALSE, FALSE),
    ('medical-1', 'gate-a', 45, 60, TRUE, FALSE, FALSE, FALSE),
    ('concourse-200', 'medical-2', 30, 40, TRUE, FALSE, FALSE, FALSE),
    ('medical-2', 'concourse-200', 30, 40, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'exit-north', 60, 100, TRUE, FALSE, FALSE, FALSE),
    ('exit-north', 'concourse-100', 60, 100, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'exit-south', 55, 90, TRUE, FALSE, FALSE, FALSE),
    ('exit-south', 'concourse-100', 55, 90, TRUE, FALSE, FALSE, FALSE),
    ('exit-north', 'parking-a', 120, 200, TRUE, FALSE, FALSE, FALSE),
    ('parking-a', 'exit-north', 120, 200, TRUE, FALSE, FALSE, FALSE),
    ('concourse-100', 'media-center', 35, 45, TRUE, FALSE, FALSE, FALSE),
    ('media-center', 'concourse-100', 35, 45, TRUE, FALSE, FALSE, FALSE)
ON CONFLICT (source_zone_id, target_zone_id) DO NOTHING;

-- Seed Data: Default Users (passwords are bcrypt hashes of 'password123')
INSERT INTO users (email, password_hash, name, role, preferred_language, accessibility_needs, is_vip, supported_team) VALUES
    ('fan@example.com', '$2b$12$LJ3m4ys3Lk0TSwHlv0IG8OQX5Lgc9B7gP5Qq8cFqZ5c9H5v5qXKHq', 'Alex Fan', 'fan', 'en', '{}', FALSE, 'USA'),
    ('vip@example.com', '$2b$12$LJ3m4ys3Lk0TSwHlv0IG8OQX5Lgc9B7gP5Qq8cFqZ5c9H5v5qXKHq', 'Jordan VIP', 'fan', 'es', '{}', TRUE, 'MEX'),
    ('accessible@example.com', '$2b$12$LJ3m4ys3Lk0TSwHlv0IG8OQX5Lgc9B7gP5Qq8cFqZ5c9H5v5qXKHq', 'Sam Access', 'fan', 'en', '{wheelchair}', FALSE, 'GBR'),
    ('staff@example.com', '$2b$12$LJ3m4ys3Lk0TSwHlv0IG8OQX5Lgc9B7gP5Qq8cFqZ5c9H5v5qXKHq', 'Morgan Staff', 'staff', 'en', '{}', FALSE, NULL),
    ('admin@example.com', '$2b$12$LJ3m4ys3Lk0TSwHlv0IG8OQX5Lgc9B7gP5Qq8cFqZ5c9H5v5qXKHq', 'Taylor Admin', 'admin', 'en', '{}', TRUE, NULL)
ON CONFLICT (email) DO NOTHING;
