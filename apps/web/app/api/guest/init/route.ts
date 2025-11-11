/**
 * POST /api/guest/init
 * 
 * Initialize a guest pig (ephemeral, device-bound)
 * Creates entry in Redis with status='guest' and device_uid
 * 
 * Body: { deviceUid: string, pigName: string }
 * Response: { pigId: string, pigName: string }
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const { deviceUid, pigName } = await req.json();

    if (!deviceUid || typeof deviceUid !== 'string') {
      return NextResponse.json(
        { error: 'Device UID is required' },
        { status: 400 }
      );
    }

    if (!pigName || typeof pigName !== 'string' || !pigName.trim()) {
      return NextResponse.json(
        { error: 'Pig name is required' },
        { status: 400 }
      );
    }

    const sanitizedName = pigName.trim().slice(0, 20);

    // Check if name is taken (check all pigs in Redis)
    const allPigKeys = await redis.keys('pig:*');
    for (const key of allPigKeys) {
      const existingPig = await redis.hgetall(key);
      if (existingPig && (existingPig as any).name === sanitizedName) {
        return NextResponse.json(
          { error: 'This name is already taken' },
          { status: 409 }
        );
      }
    }

    // Generate unique pig ID
    const pigId = uuidv4();

    // Create guest pig in Redis
    const guestPig = {
      id: pigId,
      name: sanitizedName,
      device_uid: deviceUid,
      status: 'guest',
      created_at: new Date().toISOString(),
    };

    await redis.hset(`pig:${pigId}`, guestPig);
    await redis.set(`pig_name:${sanitizedName}`, pigId); // Name → ID index
    await redis.set(`device_pig:${deviceUid}`, pigId);   // Device → Pig index

    console.log('[Guest Init] Created guest pig:', pigId, sanitizedName);

    return NextResponse.json({
      pigId,
      pigName: sanitizedName,
    });
  } catch (err) {
    console.error('[Guest Init] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
