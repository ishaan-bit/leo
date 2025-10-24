import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * GET /api/admin/diagnostics
 * 
 * Diagnostics endpoint for debugging Upstash data consistency
 * 
 * Returns:
 * - Active namespace
 * - Total reflection keys
 * - Sample SCAN results
 * - Index key lengths for pig_reflections
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pigId = searchParams.get('pigId');

    // Get environment info
    const namespace = process.env.UPSTASH_REDIS_REST_URL || 'unknown';
    const env = process.env.NODE_ENV || 'development';

    // Scan for reflection keys (limit 10)
    let reflectionKeys: string[] = [];
    try {
      // Try to get keys using pattern matching
      const keys = await kv.keys('reflection:*');
      reflectionKeys = (keys as string[]).slice(0, 10);
    } catch (error) {
      console.error('[Diagnostics] Failed to scan keys:', error);
      reflectionKeys = ['scan_not_supported'];
    }

    // Get sample reflection data
    const sampleData: Record<string, any> = {};
    for (const key of reflectionKeys.slice(0, 3)) {
      if (key !== 'scan_not_supported') {
        try {
          const data = await kv.get(key);
          sampleData[key] = data ? {
            exists: true,
            hasRid: !!(data as any).rid,
            hasFinal: !!(data as any).final,
          } : { exists: false };
        } catch (error) {
          sampleData[key] = { error: String(error) };
        }
      }
    }

    // Get pig_reflections index info if pigId provided
    let indexInfo: any = null;
    if (pigId) {
      const indexKey = `pig_reflections:${pigId}`;
      try {
        const reflectionIds = await kv.zrange(indexKey, 0, -1);
        const count = Array.isArray(reflectionIds) ? reflectionIds.length : 0;
        
        // Check if first 5 reflections actually exist
        const existenceCheck: Record<string, boolean> = {};
        if (Array.isArray(reflectionIds)) {
          for (const rid of (reflectionIds as string[]).slice(0, 5)) {
            const reflKey = `reflection:${rid}`;
            const exists = !!(await kv.get(reflKey));
            existenceCheck[rid] = exists;
          }
        }

        indexInfo = {
          indexKey,
          totalInIndex: count,
          sampleIds: Array.isArray(reflectionIds) ? reflectionIds.slice(0, 5) : [],
          existenceCheck,
        };
      } catch (error) {
        indexInfo = { error: String(error) };
      }
    }

    // Count total reflection keys
    const totalReflections = reflectionKeys.length === 10 ? '10+' : reflectionKeys.length;

    return NextResponse.json({
      success: true,
      environment: {
        namespace: namespace.split('@')[1] || 'unknown', // Extract host from URL
        env,
      },
      reflections: {
        total: totalReflections,
        sampleKeys: reflectionKeys,
        sampleData,
      },
      index: indexInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Diagnostics] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
