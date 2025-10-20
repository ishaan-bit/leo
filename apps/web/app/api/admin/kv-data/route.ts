import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Mark as dynamic since this uses searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Get all reflection IDs from global index
    const reflectionIds = await kv.zrange('reflections:all', 0, limit - 1, { rev: true }) as string[];
    
    // Fetch all reflections
    const reflections = await Promise.all(
      reflectionIds.map(async (id: string) => {
        const data = await kv.get(`reflection:${id}`);
        return data ? JSON.parse(data as string) : null;
      })
    );
    
    // Also get all pigs
    const pigKeys = await kv.keys('pig:*');
    const pigs = await Promise.all(
      pigKeys.map(async (key: string) => {
        const data = await kv.get(key);
        return data ? { key, data: JSON.parse(data as string) } : null;
      })
    );
    
    // Get all session-related keys
    const allKeys = await kv.keys('*');
    
    return NextResponse.json({
      success: true,
      stats: {
        total_reflections: reflections.filter(Boolean).length,
        total_pigs: pigs.filter(Boolean).length,
        total_keys: allKeys.length,
      },
      reflections: reflections.filter(Boolean),
      pigs: pigs.filter(Boolean),
      all_keys: allKeys,
    });
  } catch (error) {
    console.error('❌ Error fetching all data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
