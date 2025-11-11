/**
 * POST /api/pig/name
 * Save pig name for current user (guest or authenticated)
 * Uses identity-resolver for unified sid/user scoping
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from '@vercel/kv';
import { resolveIdentity, savePigName as saveToProfile } from '@/lib/identity-resolver';

export async function POST(req: NextRequest) {
  try {
    const { pigName } = await req.json();
  
    if (!pigName || typeof pigName !== 'string' || !pigName.trim()) {
      return NextResponse.json(
        { error: "Invalid pig name" }, 
        { status: 400 }
      );
    }

    const trimmedName = pigName.trim();

    // Validate name length
    if (trimmedName.length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" }, 
        { status: 400 }
      );
    }

    if (trimmedName.length > 20) {
      return NextResponse.json(
        { error: "Pig name too long (max 20 characters)" }, 
        { status: 400 }
      );
    }

    // Resolve current identity (sid or authenticated user)
    const identity = await resolveIdentity();

    // For authenticated users: check if name is unique globally
    if (identity.authId) {
      const normalizedName = trimmedName.toLowerCase();
      const nameKey = `pig_name:${identity.authId}:${normalizedName}`;
      
      const exists = await kv.exists(nameKey);
      if (exists) {
        return NextResponse.json(
          { error: "NAME_TAKEN" }, 
          { status: 409 }
        );
      }

      // Store name mapping for future uniqueness checks
      await kv.set(nameKey, {
        pigName: trimmedName,
        userId: identity.authId,
        createdAt: new Date().toISOString(),
      });
    }

    // Save pig name to profile (idempotent)
    const result = await saveToProfile(identity.effectiveId, trimmedName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save name" }, 
        { status: 500 }
      );
    }

    console.log('[API /pig/name] Saved pig name:', {
      pigName: trimmedName,
      scope: identity.effectiveScope,
      authId: identity.authId ? identity.authId.substring(0, 12) + '...' : null,
    });
    
    return NextResponse.json({ 
      success: true, 
      pigName: trimmedName,
      scope: identity.effectiveScope,
    });
  } catch (error) {
    console.error('[API /pig/name] Error:', error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}
