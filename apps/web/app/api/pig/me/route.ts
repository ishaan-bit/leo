/**
 * GET /api/pig/me
 * 
 * Get current authenticated user's pig
 * Returns pig name and metadata
 * Supports both Google auth (NextAuth) and Phone auth (JWT)
 * 
 * Response: { pigId: string, pigName: string, createdAt: string } | 404
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { redis } from '@/lib/supabase';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'your-secret-key'
);

export async function GET(req: Request) {
  try {
    // Check for NextAuth session (Google)
    const session = await getServerSession(authOptions);
    let userId: string | null = null;

    if (session?.user?.email) {
      userId = session.user.email;
    } else {
      // Check for phone auth session
      const cookies = req.headers.get('cookie') || '';
      const phoneSessionMatch = cookies.match(/leo-phone-session=([^;]+)/);
      
      if (phoneSessionMatch) {
        try {
          const token = phoneSessionMatch[1];
          const { payload } = await jwtVerify(token, JWT_SECRET);
          userId = payload.userId as string;
        } catch (err) {
          console.error('[API /pig/me] Invalid phone session:', err);
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Must be signed in' },
        { status: 401 }
      );
    }

    // Get user's pig ID
    const pigId = await redis.get(`user_pig:${userId}`);
    
    if (!pigId) {
      return NextResponse.json(
        { error: 'No pig found for this user' },
        { status: 404 }
      );
    }

    // Get pig data
    const pigData = await redis.hgetall(`pig:${pigId}`);
    
    if (!pigData || !pigData.name) {
      return NextResponse.json(
        { error: 'Pig data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      pigId: pigId as string,
      pigName: pigData.name as string,
      createdAt: pigData.created_at as string,
    });
  } catch (err) {
    console.error('[API /pig/me] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
