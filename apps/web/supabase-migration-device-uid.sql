-- Migration: Update pigs table for new architecture
-- Run this in Supabase SQL Editor

-- Step 1: Add new columns
ALTER TABLE pigs
ADD COLUMN IF NOT EXISTS device_uid TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'claimed',
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Step 2: Update schema (make pig_id optional, make id the primary key)
-- The id column already exists (UUID primary key from original schema)

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pigs_device_uid ON pigs(device_uid);
CREATE INDEX IF NOT EXISTS idx_pigs_status ON pigs(status);
CREATE INDEX IF NOT EXISTS idx_pigs_user_id ON pigs(user_id) WHERE user_id IS NOT NULL;

-- Step 4: Update existing pigs to 'claimed' status
UPDATE pigs
SET status = 'claimed'
WHERE user_id IS NOT NULL OR owner_id LIKE 'user:%';

-- Step 5: Create unique constraint for (user_id, name) when user is authenticated
-- This prevents duplicate pig names per user, but allows guests to have same name
CREATE UNIQUE INDEX IF NOT EXISTS idx_pigs_unique_user_name
ON pigs(user_id, pig_name)
WHERE user_id IS NOT NULL;

-- Step 6: Add comments
COMMENT ON COLUMN pigs.device_uid IS 'UUIDv4 device identifier for guest pigs (localStorage.leo_guest_uid)';
COMMENT ON COLUMN pigs.status IS 'Ownership status: guest (device-bound) or claimed (user-bound)';
COMMENT ON COLUMN pigs.user_id IS 'Authenticated user ID (null for guests)';

-- Step 7: Update pig_name column to be called 'name' for consistency with API
-- Check if 'name' column exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='pigs' AND column_name='pig_name'
  ) THEN
    ALTER TABLE pigs RENAME COLUMN pig_name TO name;
  END IF;
END $$;
