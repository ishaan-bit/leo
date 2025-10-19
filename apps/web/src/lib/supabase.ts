/**
 * Upstash Redis KV client for database operations
 */

import { Redis } from '@upstash/redis';

const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;

// During build time, we don't need Redis to be initialized
// Only check environment variables at runtime
let redis: Redis;

if (process.env.NEXT_PHASE === 'phase-production-build') {
  // Mock Redis client for build time
  redis = {} as Redis;
} else {
  if (!redisUrl || !redisToken) {
    throw new Error('Missing Upstash Redis environment variables. Add KV_REST_API_URL and KV_REST_API_TOKEN to .env.local');
  }
  
  redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

export { redis };

// Type definitions for stored data
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
