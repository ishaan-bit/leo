-- Supabase Database Schema for Leo Reflection System
-- Run this in Supabase SQL Editor to create tables

-- =====================================================
-- 1. REFLECTIONS TABLE
-- Stores all user reflections with identity, content, and derived signals
-- =====================================================
CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity & ownership
  owner_id TEXT NOT NULL,                    -- Format: "guest:{sessionId}" or "user:{userId}"
  user_id TEXT,                              -- Google/auth provider ID (null for guests)
  session_id TEXT NOT NULL,                  -- Browser/device session
  signed_in BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Pig context
  pig_id TEXT NOT NULL,                      -- QR code ID
  pig_name TEXT,                             -- User-given name
  
  -- Reflection content
  text TEXT NOT NULL,
  feeling_seed TEXT,                         -- Result of ritual (if any)
  
  -- Derived behavioral signals
  valence DECIMAL(3,2),                      -- -1.0 to 1.0
  arousal DECIMAL(3,2),                      -- 0.0 to 1.0
  language TEXT,                             -- 'en', 'hi', 'hinglish', etc.
  input_mode TEXT CHECK (input_mode IN ('typing', 'voice')),
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'noon', 'evening', 'night')),
  
  -- Metadata (stored as JSONB for flexibility)
  metrics JSONB,                             -- Typing/voice metrics
  device_info JSONB,                         -- Device type, platform, locale, timezone
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Consent & privacy
  consent_research BOOLEAN DEFAULT TRUE,     -- User opted into research analytics
  
  -- Indexes for fast queries
  CONSTRAINT reflections_pkey PRIMARY KEY (id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reflections_owner ON reflections(owner_id);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reflections_pig ON reflections(pig_id);
CREATE INDEX IF NOT EXISTS idx_reflections_session ON reflections(session_id);
CREATE INDEX IF NOT EXISTS idx_reflections_created ON reflections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reflections_owner_created ON reflections(owner_id, created_at DESC);

-- =====================================================
-- 2. PIGS TABLE
-- Tracks physical pigs, their names, and ownership
-- =====================================================
CREATE TABLE IF NOT EXISTS pigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  pig_id TEXT UNIQUE NOT NULL,               -- QR code ID
  pig_name TEXT,                             -- User-given name
  owner_id TEXT NOT NULL,                    -- Current owner (guest or user)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  named_at TIMESTAMPTZ,                      -- When pig was named
  last_reflection_at TIMESTAMPTZ,            -- Last time someone reflected
  
  CONSTRAINT pigs_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_pigs_pig_id ON pigs(pig_id);
CREATE INDEX IF NOT EXISTS idx_pigs_owner ON pigs(owner_id);

-- =====================================================
-- 3. SESSION_USER_LINKS TABLE
-- Maps guest sessions to user accounts (migration tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS session_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migration_completed BOOLEAN DEFAULT FALSE,  -- True after reflections migrated
  
  CONSTRAINT session_user_links_pkey PRIMARY KEY (id),
  CONSTRAINT unique_session_user UNIQUE (session_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_links_session ON session_user_links(session_id);
CREATE INDEX IF NOT EXISTS idx_links_user ON session_user_links(user_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- Enable RLS but allow all operations for now (adjust in production)
-- =====================================================
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_user_links ENABLE ROW LEVEL SECURITY;

-- Allow all operations (use more restrictive policies in production)
CREATE POLICY "Allow all reflections operations" ON reflections
  FOR ALL USING (true);

CREATE POLICY "Allow all pigs operations" ON pigs
  FOR ALL USING (true);

CREATE POLICY "Allow all session links operations" ON session_user_links
  FOR ALL USING (true);

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to get reflection count by owner
CREATE OR REPLACE FUNCTION get_reflection_count(p_owner_id TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM reflections WHERE owner_id = p_owner_id);
END;
$$ LANGUAGE plpgsql;

-- Function to get average valence/arousal by owner
CREATE OR REPLACE FUNCTION get_owner_stats(p_owner_id TEXT)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'count', COUNT(*),
      'avg_valence', AVG(valence),
      'avg_arousal', AVG(arousal),
      'first_reflection', MIN(created_at),
      'last_reflection', MAX(created_at)
    )
    FROM reflections
    WHERE owner_id = p_owner_id
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DONE!
-- Copy and run this in Supabase SQL Editor
-- Then add your Supabase URL and anon key to .env.local
-- =====================================================
