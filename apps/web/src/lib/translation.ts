/**
 * Translation Service
 * Handles Hindi/Hinglish → English translation for reflection normalization
 * Uses Google Translate API (free tier: 500K chars/month)
 */

import { logKvOperation } from './kv';

// Language detection patterns
const HINDI_CHAR_RANGE = /[\u0900-\u097F]/; // Devanagari script
const ENGLISH_WORD_PATTERN = /^[a-zA-Z\s.,!?'"()-]+$/;

export type LanguageDetection = {
  lang: 'english' | 'hindi' | 'mixed';
  confidence: number;
  hasHindiScript: boolean;
  hasEnglishWords: boolean;
};

/**
 * Common Hinglish words that indicate mixed language
 */
const HINGLISH_INDICATORS = [
  // Common Hindi words in Roman script
  'hai', 'hoga', 'karna', 'milkar', 'accha', 'laga', 'nahin', 'kya', 'kaun',
  'kab', 'kahan', 'kyun', 'kaise', 'kal', 'aaj', 'abhi', 'yaar', 'bhai',
  'dost', 'doston', 'se', 'ka', 'ki', 'ko', 'ne', 'par', 'mein', 'ho', 'ho',
  'tha', 'thi', 'the', 'rahega', 'rahegi', 'raha', 'rahe', 'rahi',
  // Common verbs
  'kar', 'karo', 'karu', 'karke', 'karein', 'hoon', 'hun', 'ho', 'hain',
  'tha', 'thi', 'the', 'gaya', 'gayi', 'gaye', 'liya', 'diya', 'aya', 'ayi',
];

/**
 * Detect language of input text
 */
export function detectLanguage(text: string): LanguageDetection {
  if (!text || text.trim().length === 0) {
    return {
      lang: 'english',
      confidence: 0,
      hasHindiScript: false,
      hasEnglishWords: false,
    };
  }

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  const hasHindiScript = HINDI_CHAR_RANGE.test(text);
  const hasEnglishWords = /[a-zA-Z]/.test(text);
  
  // Check for Hinglish indicators (Hindi words in Roman script)
  const hinglishWordCount = words.filter(word => 
    HINGLISH_INDICATORS.some(indicator => word.includes(indicator))
  ).length;
  const hinglishRatio = hinglishWordCount / words.length;

  // Pure Hindi (has Devanagari, no English letters)
  if (hasHindiScript && !/[a-zA-Z]/.test(text)) {
    return {
      lang: 'hindi',
      confidence: 0.95,
      hasHindiScript: true,
      hasEnglishWords: false,
    };
  }

  // Mixed/Hinglish (has Devanagari + English OR has Hinglish indicators)
  if (hasHindiScript || hinglishRatio > 0.2) {
    return {
      lang: 'mixed',
      confidence: 0.85,
      hasHindiScript,
      hasEnglishWords,
    };
  }

  // Pure English (no Hindi script, no Hinglish indicators)
  if (!hasHindiScript && hinglishRatio < 0.1) {
    return {
      lang: 'english',
      confidence: 0.9,
      hasHindiScript: false,
      hasEnglishWords: true,
    };
  }

  // Default fallback to mixed for safety
  return {
    lang: 'mixed',
    confidence: 0.6,
    hasHindiScript,
    hasEnglishWords,
  };
}

/**
 * Normalize English text (clean grammar, punctuation, casing)
 */
function normalizeEnglishText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')              // Multiple spaces → single space
    .replace(/\.{2,}/g, '.')           // Multiple dots → single dot
    .replace(/\?{2,}/g, '?')           // Multiple ? → single ?
    .replace(/!{2,}/g, '!')            // Multiple ! → single !
    .replace(/\s+([.,!?])/g, '$1')    // Remove space before punctuation
    .replace(/([.,!?])([a-zA-Z])/g, '$1 $2'); // Add space after punctuation
}

/**
 * Translate text to English using Google Translate API
 * Free tier: 500,000 characters/month
 */
export async function translateToEnglish(
  text: string,
  detectedLang: 'english' | 'hindi' | 'mixed'
): Promise<{
  translatedText: string;
  usedTranslation: boolean;
  error: string | null;
}> {
  const startTime = Date.now();

  // If already English, just normalize
  if (detectedLang === 'english') {
    const normalized = normalizeEnglishText(text);
    console.log('[TRANSLATION]', {
      op: 'normalize_only',
      lang: 'english',
      original_length: text.length,
      normalized_length: normalized.length,
      duration_ms: Date.now() - startTime,
    });
    return {
      translatedText: normalized,
      usedTranslation: false,
      error: null,
    };
  }

  // Check if Google Translate API key is available
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    console.warn('[TRANSLATION] No API key found, using fallback normalization');
    return {
      translatedText: normalizeEnglishText(text),
      usedTranslation: false,
      error: 'GOOGLE_TRANSLATE_API_KEY not configured',
    };
  }

  try {
    // Google Translate API endpoint
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target: 'en',
        format: 'text',
        // Auto-detect source language (handles Hindi + Hinglish)
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Google Translate API error: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText;

    if (!translatedText) {
      throw new Error('No translation returned from Google Translate API');
    }

    // Normalize the translated output
    const normalized = normalizeEnglishText(translatedText);

    console.log('[TRANSLATION]', {
      op: 'translate_success',
      lang: detectedLang,
      original_length: text.length,
      translated_length: normalized.length,
      duration_ms: Date.now() - startTime,
      preview: normalized.substring(0, 50),
    });

    return {
      translatedText: normalized,
      usedTranslation: true,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error('[TRANSLATION]', {
      op: 'translate_error',
      lang: detectedLang,
      error: errorMessage,
      duration_ms: Date.now() - startTime,
    });

    // Fallback: return normalized original text
    return {
      translatedText: normalizeEnglishText(text),
      usedTranslation: false,
      error: errorMessage,
    };
  }
}

/**
 * Translate English text to Hindi using Google Translate API
 * For moment detail view language toggle
 * Calls server-side API to access GOOGLE_TRANSLATE_API_KEY securely
 */
export async function translateToHindi(
  text: string
): Promise<{
  translatedText: string;
  error: string | null;
}> {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        target: 'hi',
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      translatedText: data.translatedText || text,
      error: data.error,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[TRANSLATION] Client error:', errorMessage);
    
    return {
      translatedText: text,
      error: errorMessage,
    };
  }
}

/**
 * Main translation pipeline
 * Detects language → translates if needed → returns normalized English
 */
export async function processReflectionText(rawText: string): Promise<{
  normalizedText: string;
  langDetected: string;
  translationUsed: boolean;
  translationError: string | null;
}> {
  const detection = detectLanguage(rawText);
  const { translatedText, usedTranslation, error } = await translateToEnglish(
    rawText,
    detection.lang
  );

  return {
    normalizedText: translatedText,
    langDetected: detection.lang,
    translationUsed: usedTranslation,
    translationError: error,
  };
}
