/**
 * Multilingual text processing for Hindi, Hinglish, English, and slang
 * Handles soft autocorrect, language detection, and normalization
 */

export interface ProcessedText {
  original: string;
  normalized: string;
  detectedLanguage: 'en' | 'hi' | 'hinglish' | 'mixed';
  confidence: number;
}

// Common Hinglish → English phrase mappings
const hinglishPhrases: Record<string, string> = {
  // Emotional states
  'dil halka ho gaya': 'my heart felt lighter',
  'dil bhari hai': 'my heart feels heavy',
  'mann udas hai': 'feeling sad',
  'achha lag raha hai': 'feeling good',
  'ajeeb lag raha hai': 'feeling strange',
  'thoda sa': 'a little bit',
  'bahut zyada': 'too much',
  'kuch khas nahi': 'nothing special',
  
  // Social expressions
  'yaar': 'friend',
  'bhai': 'brother',
  'dost': 'friend',
  'sach mein': 'really',
  'kya baat hai': 'what a thing',
  'chalo theek hai': 'alright then',
  
  // Time/frequency
  'aaj': 'today',
  'kal': 'yesterday/tomorrow',
  'abhi': 'now',
  'phir se': 'again',
  'kabhi kabhi': 'sometimes',
  
  // Intensifiers
  'bilkul': 'absolutely',
  'ekdum': 'completely',
  'thoda': 'a little',
  'kaafi': 'quite',
};

// Common typos and soft corrections (non-intrusive)
const softCorrections: Record<string, string> = {
  'wierd': 'weird',
  'recieve': 'receive',
  'occured': 'occurred',
  'seperate': 'separate',
  'definately': 'definitely',
  'thier': 'their',
  'untill': 'until',
  'tommorow': 'tomorrow',
};

/**
 * Detect if text contains Devanagari script
 */
function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Detect if text contains Hinglish patterns
 * (Roman script with Hindi word structure or mixed phrases)
 */
function hasHinglishPatterns(text: string): boolean {
  const hinglishWords = Object.keys(hinglishPhrases);
  const lowerText = text.toLowerCase();
  
  return hinglishWords.some(phrase => lowerText.includes(phrase));
}

/**
 * Detect language of input text
 */
export function detectLanguage(text: string): {
  language: 'en' | 'hi' | 'hinglish' | 'mixed';
  confidence: number;
} {
  const hasDevScript = hasDevanagari(text);
  const hasHinglish = hasHinglishPatterns(text);
  
  if (hasDevScript && hasHinglish) {
    return { language: 'mixed', confidence: 0.9 };
  }
  
  if (hasDevScript) {
    return { language: 'hi', confidence: 0.95 };
  }
  
  if (hasHinglish) {
    return { language: 'hinglish', confidence: 0.85 };
  }
  
  // Default to English
  return { language: 'en', confidence: 0.8 };
}

/**
 * Apply soft autocorrect - only fix obvious typos, preserve intentional slang
 */
export function applySoftAutocorrect(text: string): string {
  let corrected = text;
  
  // Apply word-by-word corrections
  const words = text.split(/\b/);
  const correctedWords = words.map(word => {
    const lower = word.toLowerCase();
    return softCorrections[lower] || word;
  });
  
  return correctedWords.join('');
}

/**
 * Normalize Hinglish phrases to English
 * Preserves original emotion and meaning
 */
export function normalizeHinglish(text: string): string {
  let normalized = text;
  const lowerText = text.toLowerCase();
  
  // Replace Hinglish phrases with English equivalents
  Object.entries(hinglishPhrases).forEach(([hinglish, english]) => {
    const regex = new RegExp(hinglish, 'gi');
    normalized = normalized.replace(regex, english);
  });
  
  return normalized;
}

/**
 * Main text processing pipeline
 * Handles multilingual input and normalizes to English while preserving emotion
 */
export function processText(text: string): ProcessedText {
  const original = text;
  
  // Step 1: Detect language
  const { language, confidence } = detectLanguage(text);
  
  // Step 2: Apply soft autocorrect
  let processed = applySoftAutocorrect(text);
  
  // Step 3: Normalize based on language
  if (language === 'hinglish' || language === 'mixed') {
    processed = normalizeHinglish(processed);
  }
  
  // For pure Hindi (Devanagari), we'd need a translation API
  // For now, preserve it as-is and mark for server-side processing
  if (language === 'hi') {
    // TODO: Integrate translation API (Google Translate / Azure / custom model)
    // For MVP, we'll store original and let backend handle translation
    processed = text;
  }
  
  // Step 4: Clean up extra spaces and punctuation
  processed = processed
    .replace(/\s+/g, ' ')  // collapse multiple spaces
    .replace(/\s+([,.!?])/g, '$1')  // fix spacing before punctuation
    .trim();
  
  return {
    original,
    normalized: processed,
    detectedLanguage: language,
    confidence,
  };
}

/**
 * Validate if text is substantial enough for a reflection
 */
export function validateReflection(text: string): {
  valid: boolean;
  reason?: string;
} {
  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Reflection cannot be empty' };
  }
  
  if (trimmed.length < 3) {
    return { valid: false, reason: 'Reflection is too short' };
  }
  
  // Check for meaningful content (not just punctuation/numbers)
  const hasLetters = /[a-zA-Z\u0900-\u097F]/.test(trimmed);
  if (!hasLetters) {
    return { valid: false, reason: 'Reflection needs some words' };
  }
  
  return { valid: true };
}

/**
 * Extract keywords from reflection for tagging
 * Simple extraction - can be enhanced with NLP
 */
export function extractKeywords(text: string, limit: number = 5): string[] {
  // Remove common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  ]);
  
  // Extract words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
  
  // Count frequency
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  // Sort by frequency and take top keywords
  const keywords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
  
  return keywords;
}
