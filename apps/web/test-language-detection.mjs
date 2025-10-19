/**
 * Test script for Hindi/Hinglish language detection
 * Run: node test-language-detection.mjs
 */

// Hinglish detection patterns
const HINGLISH_INDICATORS = [
  'hai', 'hoga', 'karna', 'milkar', 'accha', 'laga', 'nahin', 'kya', 'kaun',
  'kab', 'kahan', 'kyun', 'kaise', 'kal', 'aaj', 'abhi', 'yaar', 'bhai',
  'dost', 'doston', 'se', 'ka', 'ki', 'ko', 'ne', 'par', 'mein', 'ho',
  'tha', 'thi', 'the', 'rahega', 'rahegi', 'raha', 'rahe', 'rahi',
  'kar', 'karo', 'karu', 'karke', 'karein', 'hoon', 'hun', 'hain',
  'gaya', 'gayi', 'gaye', 'liya', 'diya', 'aya', 'ayi',
];

const HINDI_CHAR_RANGE = /[\u0900-\u097F]/;

function detectLanguage(text) {
  if (!text || text.trim().length === 0) {
    return { lang: 'english', confidence: 0 };
  }

  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  const hasHindiScript = HINDI_CHAR_RANGE.test(text);
  const hasEnglishWords = /[a-zA-Z]/.test(text);
  
  const hinglishWordCount = words.filter(word => 
    HINGLISH_INDICATORS.some(indicator => word.includes(indicator))
  ).length;
  const hinglishRatio = hinglishWordCount / words.length;

  // Pure Hindi (has Devanagari, no English letters)
  if (hasHindiScript && !/[a-zA-Z]/.test(text)) {
    return { lang: 'hindi', confidence: 0.95, hinglishRatio };
  }

  // Mixed/Hinglish (has Devanagari + English OR has Hinglish indicators)
  if (hasHindiScript || hinglishRatio > 0.2) {
    return { lang: 'mixed', confidence: 0.85, hinglishRatio };
  }

  // Pure English
  if (!hasHindiScript && hinglishRatio < 0.1) {
    return { lang: 'english', confidence: 0.9, hinglishRatio };
  }

  return { lang: 'mixed', confidence: 0.6, hinglishRatio };
}

// Test cases
const testCases = [
  {
    name: 'Pure English',
    text: 'I had a great day meeting my friends yesterday',
  },
  {
    name: 'Pure Hinglish',
    text: 'kal doston se milkar accha laga',
  },
  {
    name: 'Your example',
    text: 'check karna hai ki Hindi se English translation Hoga ya nahin',
  },
  {
    name: 'Mixed Hindi script',
    text: 'आज बहुत accha din tha',
  },
  {
    name: 'Pure Hindi (Devanagari)',
    text: 'आज मेरा दिन बहुत अच्छा था',
  },
  {
    name: 'Hinglish with English',
    text: 'Yaar aaj office mein bahut kaam tha',
  },
  {
    name: 'Short Hinglish',
    text: 'hai yaar',
  },
];

console.log('=== Language Detection Test Results ===\n');

testCases.forEach(({ name, text }) => {
  const result = detectLanguage(text);
  console.log(`📝 ${name}`);
  console.log(`   Text: "${text}"`);
  console.log(`   → Language: ${result.lang.toUpperCase()}`);
  console.log(`   → Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`   → Hinglish ratio: ${(result.hinglishRatio * 100).toFixed(0)}%`);
  console.log('');
});

console.log('\n✅ Expected results:');
console.log('   - "kal doston se milkar accha laga" → MIXED');
console.log('   - "check karna hai ki..." → MIXED');
console.log('   - Pure English → ENGLISH');
console.log('   - Pure Devanagari → HINDI');
