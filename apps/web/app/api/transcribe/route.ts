import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';

export const runtime = 'nodejs';
export const maxDuration = 10; // 10s max (well under 800ms target)

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
      console.error('[Transcribe] DEEPGRAM_API_KEY not configured');
      return NextResponse.json(
        { error: 'Deepgram API key not configured' },
        { status: 500 }
      );
    }

    // Get audio blob from request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log(`[Transcribe] Received audio: ${audioFile.size} bytes, type: ${audioFile.type}`);

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initialize Deepgram client
    const deepgram = createClient(apiKey);

    // Transcribe with Deepgram
    const startTime = Date.now();
    
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2', // Latest model (fast + accurate)
        smart_format: true, // Auto-capitalize, punctuate
        language: 'en', // Assume English (you can add language detection if needed)
        punctuate: true,
        diarize: false, // Single speaker
      }
    );

    const latency = Date.now() - startTime;
    console.log(`[Transcribe] Deepgram latency: ${latency}ms`);

    if (error) {
      console.error('[Transcribe] Deepgram error:', error);
      return NextResponse.json(
        { error: 'Transcription failed', details: error.message },
        { status: 500 }
      );
    }

    // Extract transcript
    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    const confidence = result.results?.channels[0]?.alternatives[0]?.confidence || 0;

    console.log(`[Transcribe] Success: "${transcript}" (confidence: ${confidence.toFixed(2)})`);

    return NextResponse.json({
      transcript,
      confidence,
      latency,
    });

  } catch (err) {
    console.error('[Transcribe] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Transcription failed', details: (err as Error).message },
      { status: 500 }
    );
  }
}
