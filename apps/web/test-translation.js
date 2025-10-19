/**
 * Quick test for Hindi/Hinglish translation
 * Run: node test-translation.js
 */

const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o';

async function testTranslation(text) {
  console.log('\n🧪 Testing:', text);
  
  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: 'en',
        format: 'text',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error:', error);
      return;
    }

    const data = await response.json();
    const translated = data.data?.translations?.[0]?.translatedText;
    
    console.log('✅ Original:', text);
    console.log('✅ Translated:', translated);
    console.log('✅ Detected language:', data.data?.translations?.[0]?.detectedSourceLanguage);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

async function runTests() {
  console.log('🌐 Google Translate API Test\n');
  
  // Test 1: Pure Hinglish
  await testTranslation('kal doston se milkar accha laga');
  
  // Test 2: Mixed Hindi-English
  await testTranslation('check karna hai ki Hindi se English translation Hoga ya nahin');
  
  // Test 3: Pure Hindi (Devanagari)
  await testTranslation('मुझे बहुत अच्छा लगा');
  
  // Test 4: Pure English
  await testTranslation('I felt really good today');
  
  console.log('\n✅ All tests complete!');
}

runTests();
