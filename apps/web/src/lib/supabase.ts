/**
 * Supabase client for database operations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions for database tables
export type ReflectionRow = {
  id: string;
  
  // Identity
  owner_id: string;           // guest:{sessionId} or user:{userId}
  user_id: string | null;     // Only if signed in
  session_id: string;         // Always present
  signed_in: boolean;
  
  // Pig
  pig_id: string;
  pig_name: string | null;
  
  // Reflection content
  text: string;
  feeling_seed: string | null;
  
  // Derived signals
  valence: number | null;
  arousal: number | null;
  language: string | null;
  input_mode: 'typing' | 'voice';
  time_of_day: 'morning' | 'noon' | 'evening' | 'night' | null;
  
  // Metadata (JSON)
  metrics: any;               // Typing/voice metrics
  device_info: any;           // Device, platform, locale
  
  // Timestamps
  created_at: string;
  
  // Consent & privacy
  consent_research: boolean;
};

export type PigRow = {
  id: string;
  pig_id: string;             // QR code ID
  pig_name: string | null;
  owner_id: string;           // Current owner
  created_at: string;
  named_at: string | null;
  last_reflection_at: string | null;
};

export type SessionUserLinkRow = {
  id: string;
  session_id: string;
  user_id: string;
  linked_at: string;
  migration_completed: boolean;
};
