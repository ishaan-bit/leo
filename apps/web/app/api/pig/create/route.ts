/**
 * POST /api/pig/create
 * 
 * Create a persistent pig for authenticated user
 * Validates uniqueness per user
 * 
 * Body: { pigName: string }
 * Response: { success: true, pigName: string }
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { redis } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    // Must be authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Must be signed in to create a pig' },
        { status: 401 }
      );
    }

    const { pigName } = await req.json();

    if (!pigName || typeof pigName !== 'string' || !pigName.trim()) {
      return NextResponse.json(
        { error: 'Pig name is required' },
        { status: 400 }
      );
    }

    const sanitizedName = pigName.trim().slice(0, 20);

    // Validate name format (2-20 chars, a-z0-9_-)
    if (sanitizedName.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_-]+$/i.test(sanitizedName)) {
      return NextResponse.json(
        { error: 'Only letters, numbers, hyphens, and underscores allowed' },
        { status: 400 }
      );
    }

    // Check if user already has a pig
    const userId = session.user.email; // Using email as user ID
    const existingPigId = await redis.get(`user_pig:${userId}`);
    
    if (existingPigId) {
      return NextResponse.json(
        { error: 'You already have a pig' },
        { status: 409 }
      );
    }

    // Check if name is taken by any user (global uniqueness)
    const existingPigByName = await redis.get(`pig_name:${sanitizedName}`);
    if (existingPigByName) {
      return NextResponse.json(
        { error: 'This name is already taken' },
        { status: 409 }
      );
    }

    // Create pig
    const pigId = uuidv4();
    const pigData = {
      id: pigId,
      name: sanitizedName,
      user_id: userId,
      status: 'claimed',
      created_at: new Date().toISOString(),
    };

    // Store pig data
    await redis.hset(`pig:${pigId}`, pigData);
    
    // Create indexes
    await redis.set(`pig_name:${sanitizedName}`, pigId); // Name → ID
    await redis.set(`user_pig:${userId}`, pigId);        // User → Pig ID

    console.log('[API /pig/create] Created pig:', pigId, sanitizedName, 'for user:', userId);

    return NextResponse.json({
      success: true,
      pigName: sanitizedName,
    });
  } catch (err) {
    console.error('[API /pig/create] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
