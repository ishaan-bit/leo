import { NextRequest, NextResponse } from 'next/server';

/**
 * Translate text to Hindi using Google Translate API
 * POST /api/translate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, target = 'hi' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    
    if (!apiKey) {
      console.warn('[TRANSLATION API] No API key found');
      return NextResponse.json(
        { translatedText: text, error: 'API key not configured' },
        { status: 200 } // Still return 200 with original text as fallback
      );
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target,
        format: 'text',
        source: 'en',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[TRANSLATION API] Error:', errorData);
      return NextResponse.json(
        { translatedText: text, error: 'Translation failed' },
        { status: 200 } // Fallback to original text
      );
    }

    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText;

    if (!translatedText) {
      console.error('[TRANSLATION API] No translation returned');
      return NextResponse.json(
        { translatedText: text, error: 'No translation returned' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      translatedText,
      error: null,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[TRANSLATION API] Exception:', errorMessage);
    
    return NextResponse.json(
      { translatedText: '', error: errorMessage },
      { status: 500 }
    );
  }
}
