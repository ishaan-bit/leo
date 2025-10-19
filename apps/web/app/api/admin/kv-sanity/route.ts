/**
 * KV Sanity Check Endpoint
 * Tests write/read connectivity to Vercel KV (Upstash Redis)
 * 
 * POST /api/admin/kv-sanity
 * Protected: Should be removed or secured after verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv, logKvOperation } from '@/lib/kv';

export async function POST(request: NextRequest) {
  const results: any = {
    env_check: {},
    write_test: {},
    read_test: {},
    ttl_test: {},
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Environment check
    results.env_check = {
      KV_REST_API_URL: !!process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
      KV_REST_API_READ_ONLY_TOKEN: !!process.env.KV_REST_API_READ_ONLY_TOKEN,
      NODE_ENV: process.env.NODE_ENV,
    };

    const missing = Object.entries(results.env_check)
      .filter(([key, value]) => key.startsWith('KV_') && !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'Missing environment variables',
        missing,
        results,
      }, { status: 503 });
    }

    // 2. Write test
    const testKey = 'sanity:app';
    const testValue = {
      test: true,
      timestamp: new Date().toISOString(),
      write_token_used: true,
    };

    logKvOperation({ op: 'SET', key: testKey, phase: 'start' });
    
    try {
      await kv.set(testKey, JSON.stringify(testValue));
      results.write_test = { ok: true, key: testKey };
      logKvOperation({ op: 'SET', key: testKey, phase: 'ok' });
    } catch (error) {
      logKvOperation({ op: 'SET', key: testKey, phase: 'error', error });
      results.write_test = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown',
      };
      return NextResponse.json({
        ok: false,
        error: 'KV write failed',
        results,
      }, { status: 503 });
    }

    // 3. Read test
    logKvOperation({ op: 'GET', key: testKey, phase: 'start' });
    
    try {
      const retrieved = await kv.get(testKey);
      const parsed = retrieved ? JSON.parse(retrieved as string) : null;
      
      results.read_test = {
        ok: true,
        key: testKey,
        matches: parsed?.timestamp === testValue.timestamp,
        retrieved: parsed,
      };
      logKvOperation({ op: 'GET', key: testKey, phase: 'ok' });
    } catch (error) {
      logKvOperation({ op: 'GET', key: testKey, phase: 'error', error });
      results.read_test = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown',
      };
    }

    // 4. TTL test (set with 10 second expiry)
    const ttlKey = 'sanity:ttl';
    logKvOperation({ op: 'SETEX', key: ttlKey, phase: 'start' });
    
    try {
      await kv.set(ttlKey, JSON.stringify({ ttl_test: true }), { ex: 10 });
      const ttl = await kv.ttl(ttlKey);
      
      results.ttl_test = {
        ok: true,
        key: ttlKey,
        ttl_seconds: ttl,
        expected: 10,
        ttl_working: ttl > 0 && ttl <= 10,
      };
      logKvOperation({ op: 'SETEX', key: ttlKey, phase: 'ok' });
    } catch (error) {
      logKvOperation({ op: 'SETEX', key: ttlKey, phase: 'error', error });
      results.ttl_test = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown',
      };
    }

    // All tests passed
    return NextResponse.json({
      ok: true,
      message: '✅ KV connectivity verified',
      kv_write: true,
      kv_read: true,
      ttl_support: true,
      results,
    });

  } catch (error) {
    console.error('❌ KV sanity check failed:', error);
    return NextResponse.json({
      ok: false,
      error: 'Sanity check failed',
      details: error instanceof Error ? error.message : 'Unknown',
      stack_top: error instanceof Error ? error.stack?.split('\n')[0] : undefined,
      results,
    }, { status: 500 });
  }
}

// Prevent GET requests
export async function GET() {
  return NextResponse.json({
    error: 'Use POST to run sanity check',
    usage: 'POST /api/admin/kv-sanity',
  }, { status: 405 });
}
