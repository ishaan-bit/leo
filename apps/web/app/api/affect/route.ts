import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

/**
 * POST /api/affect
 * Persist affect vector for authenticated users
 * Currently a stub - will integrate with database later
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - sign in required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { affect, scene, timestamp } = body;

    // Stub: Log to console for now
    console.log('[API /affect] Persisting affect vector:', {
      userId: session.user.email,
      scene: scene || 'awakening',
      affect,
      timestamp: timestamp || new Date().toISOString(),
    });

    // TODO: Integrate with database
    // await db.affectVectors.create({
    //   userId: session.user.id,
    //   scene,
    //   valence: affect.valence,
    //   arousal: affect.arousal,
    //   depth: affect.depth,
    //   clarity: affect.clarity,
    //   authenticity: affect.authenticity,
    //   effort: affect.effort,
    //   seed: affect.seed,
    //   createdAt: new Date(timestamp),
    // });

    return NextResponse.json({
      success: true,
      message: 'Affect vector logged (stub)',
    });
  } catch (error) {
    console.error('[API /affect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to persist affect' },
      { status: 500 }
    );
  }
}
