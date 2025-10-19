/**
 * Debug endpoint to test Google Translate API directly
 * DELETE THIS FILE after debugging is complete
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      error: 'API key not found',
      hasKey: false,
    });
  }

  try {
    const testText = 'Kafi Dinon bad Doston Se Milkar bahut Achcha Laga';
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    console.log('[TEST-TRANSLATE] Calling Google Translate API...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: testText,
        target: 'en',
        format: 'text',
      }),
    });

    console.log('[TEST-TRANSLATE] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TEST-TRANSLATE] Error response:', errorText);
      
      return NextResponse.json({
        error: 'API call failed',
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        hasKey: true,
        keyPreview: `${apiKey.substring(0, 10)}...`,
      });
    }

    const data = await response.json();
    console.log('[TEST-TRANSLATE] Success:', data);

    return NextResponse.json({
      success: true,
      hasKey: true,
      keyPreview: `${apiKey.substring(0, 10)}...`,
      testInput: testText,
      translation: data.data?.translations?.[0]?.translatedText,
      fullResponse: data,
    });

  } catch (error) {
    console.error('[TEST-TRANSLATE] Exception:', error);
    return NextResponse.json({
      error: 'Exception occurred',
      message: error instanceof Error ? error.message : String(error),
      hasKey: true,
    });
  }
}
