/**
 * Vercel KV Client (Upstash Redis)
 * Centralized KV client for all database operations
 */

import { kv as vercelKv } from '@vercel/kv';

// Environment validation
const envVars = {
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
  readOnlyToken: process.env.KV_REST_API_READ_ONLY_TOKEN,
};

// Fail-fast during runtime if env vars missing
if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
  const missing = Object.entries(envVars)
    .filter(([_, value]) => !value)
    .map(([key]) => `KV_REST_API_${key.toUpperCase()}`);
  
  if (missing.length > 0 && missing.includes('KV_REST_API_URL')) {
    console.error('❌ Missing required KV environment variables:', missing);
    console.error('📝 Add them to apps/web/.env.local');
  }
}

// Export the Vercel KV client (uses write token by default)
export const kv = vercelKv;

/**
 * Structured logging helper for KV operations
 */
export function logKvOperation(data: {
  op: string;
  key: string;
  phase: 'start' | 'ok' | 'error';
  sid?: string;
  rid?: string;
  error?: any;
}) {
  const timestamp = new Date().toISOString();
  const logData = {
    timestamp,
    service: 'kv',
    ...data,
  };

  if (data.phase === 'error') {
    console.error('KV_ERROR', JSON.stringify({
      ...logData,
      reason: data.error?.message || 'Unknown',
      stack_top: data.error?.stack?.split('\n')[0],
    }));
  } else if (data.phase === 'ok') {
    console.log('KV_OK', JSON.stringify(logData));
  } else {
    console.log('KV_START', JSON.stringify(logData));
  }
}

/**
 * Generate unique reflection ID
 */
export function generateReflectionId(): string {
  return `refl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
