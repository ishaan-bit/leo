/**
 * Image Upload Reflection API
 * POST /api/reflect/upload-image
 * 
 * Accepts image upload, converts to narrative text via image-captioning service,
 * then saves as reflection and triggers enrichment pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getSid, buildOwnerId } from '@/lib/auth-helpers';
import { kv, generateReflectionId } from '@/lib/kv';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Image captioning service URL (local or production)
const IMAGE_CAPTIONING_URL = process.env.IMAGE_CAPTIONING_URL || 'http://localhost:5050';

export async function POST(request: NextRequest) {
  try {
    console.log('📸 [1/7] Image upload reflection initiated');
    
    // Get auth state
    const auth = await getAuth();
    const sid = await getSid();
    const userId = auth?.userId || null;
    const ownerId = buildOwnerId(userId, sid);
    
    console.log('📸 [2/7] Auth:', { userId, sid, ownerId });
    
    if (!ownerId) {
      return NextResponse.json(
        { error: 'No owner_id available' },
        { status: 400 }
      );
    }
    
    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const pigId = formData.get('pigId') as string;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }
    
    if (!pigId) {
      return NextResponse.json(
        { error: 'Missing pigId' },
        { status: 400 }
      );
    }
    
    // Validate file size
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image size exceeds 10MB limit' },
        { status: 400 }
      );
    }
    
    console.log('📸 [3/7] Image file:', {
      name: imageFile.name,
      type: imageFile.type,
      size: imageFile.size,
    });
    
    // Call image captioning service
    console.log('📸 [4/7] Calling image captioning service...', IMAGE_CAPTIONING_URL);
    const captionFormData = new FormData();
    captionFormData.append('image', imageFile);
    
    let captionResponse;
    try {
      captionResponse = await fetch(`${IMAGE_CAPTIONING_URL}/caption`, {
        method: 'POST',
        body: captionFormData,
        signal: AbortSignal.timeout(180000), // 3 min timeout
      });
    } catch (fetchError) {
      console.error('❌ Failed to connect to image-captioning service:', fetchError);
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      
      if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('fetch failed')) {
        return NextResponse.json(
          { 
            error: 'Image captioning service not available',
            details: `Could not connect to ${IMAGE_CAPTIONING_URL}. Is the service running? Run: python image-captioning-service/app.py`,
          },
          { status: 503 }
        );
      }
      
      throw fetchError;
    }
    
    if (!captionResponse.ok) {
      const errorText = await captionResponse.text();
      console.error('❌ Image captioning failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate narrative from image', details: errorText },
        { status: 500 }
      );
    }
    
    const captionData = await captionResponse.json();
    const narrativeText = captionData.narrative;
    
    console.log('📸 [5/7] Generated narrative:', narrativeText);
    
    // Generate reflection ID
    const rid = generateReflectionId();
    const timestamp = new Date().toISOString();
    
    // Create reflection object (minimal - enrichment will add more)
    const reflection = {
      rid,
      sid,
      timestamp,
      pig_id: pigId,
      owner_id: ownerId,
      user_id: userId,
      signed_in: !!userId,
      
      // Raw data from image
      original_text: narrativeText, // From vision model
      normalized_text: narrativeText, // Same as original for now
      
      // Metadata
      input_mode: 'photo',
      image_filename: imageFile.name,
      image_size: imageFile.size,
      vision_model: captionData.model || 'llava:latest',
      
      // Placeholder values (enrichment will compute these)
      final: null,
      post_enrichment: null,
      
      // Device info
      device: {
        type: 'unknown',
        platform: 'unknown',
      },
    };
    
    console.log('📸 [6/7] Saving reflection to KV:', rid);
    
    // Save to KV
    const reflectionKey = `refl:${rid}`;
    await kv.set(reflectionKey, reflection, {
      ex: 30 * 24 * 60 * 60, // 30 days TTL
    });
    
    // Add to pig's reflection list
    const pigReflectionsKey = `pig_reflections:${pigId}`;
    await kv.zadd(pigReflectionsKey, {
      score: Date.now(),
      member: rid,
    });
    
    // Add to normalized queue for enrichment worker
    await kv.rpush('reflections:normalized', rid);
    
    console.log('✅ Image reflection created successfully');
    
    return NextResponse.json({
      success: true,
      reflectionId: rid,
      narrative: narrativeText,
      message: 'Image processed and moment saved',
    });
    
  } catch (error) {
    console.error('❌ Image upload error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Detailed error response
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    };
    
    console.error('❌ Error details:', JSON.stringify(errorDetails, null, 2));
    
    return NextResponse.json(
      { 
        error: 'Failed to process image upload',
        details: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      },
      { status: 500 }
    );
  }
}
