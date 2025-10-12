-- File: infrastructure/docker/init-db.sql
-- Purpose: Initialize database with portal schema

-- Create portal schema
CREATE SCHEMA IF NOT EXISTS portal;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA portal TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA portal TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA portal TO postgres;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set search path
ALTER DATABASE healthflow_development SET search_path TO public, portal;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Portal schema initialized successfully';
END $$;