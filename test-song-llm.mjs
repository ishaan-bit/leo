/**
 * Test LLM song generation with mock emotion data
 */

async function testOllamaDirectly() {
  console.log('🎵 Testing Ollama phi3 song generation...\n');
  
  const valence = 0.42;
  const arousal = 0.68;
  const invoked = 'grateful';
  const expressed = 'love and appreciation';
  
  const prompt = `You are a music curator specializing in 1960-1975 era songs. Analyze this emotional state and suggest TWO songs that match the feeling:

EMOTION DATA:
- Valence (positivity): ${valence.toFixed(2)} (range: -1 to +1)
- Arousal (energy): ${arousal.toFixed(2)} (range: 0 to 1)
- Invoked feeling: "${invoked}"
- Expressed feeling: "${expressed}"

REQUIREMENTS:
1. ONE English song (pop/folk/rock/soul/blues from 1960-1975)
2. ONE Hindi song (Bollywood/ghazal/classical-fusion from 1960-1975)
3. Each song must emotionally match the valence, arousal, and expressed feelings
4. Provide exact title, artist, and year
5. Explain why each song fits this emotional state (2-3 sentences max)

OUTPUT FORMAT (JSON only, no other text):
{
  "en": {
    "title": "Song Title",
    "artist": "Artist Name",
    "year": 1970,
    "youtube_id": "dQw4w9WgXcQ",
    "why": "Brief explanation of emotional match"
  },
  "hi": {
    "title": "Song Title (in English script)",
    "artist": "Artist Name",
    "year": 1970,
    "youtube_id": "dQw4w9WgXcQ",
    "why": "Brief explanation of emotional match"
  }
}`;

  console.log('📤 Sending to Ollama phi3...');
  const start = Date.now();
  
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'phi3:latest',
      prompt,
      stream: false,
      options: {
        temperature: 0.8,
        top_p: 0.9,
        num_predict: 500,
      },
    }),
  });
  
  const data = await response.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  
  console.log(`\n⏱️  Generation time: ${elapsed}s\n`);
  console.log('📝 Raw LLM response:');
  console.log(data.response);
  console.log('\n---\n');
  
  // Parse JSON
  let jsonText = data.response.trim();
  const jsonMatch = data.response.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                   data.response.match(/(\{[\s\S]*\})/);
  
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }
  
  const parsed = JSON.parse(jsonText);
  
  console.log('✅ Parsed JSON:');
  console.log(JSON.stringify(parsed, null, 2));
  console.log('\n🎸 English song:');
  console.log(`   ${parsed.en.title} - ${parsed.en.artist} (${parsed.en.year})`);
  console.log(`   YouTube ID: ${parsed.en.youtube_id || 'MISSING'}`);
  console.log(`   Why: ${parsed.en.why}`);
  
  console.log('\n🎶 Hindi song:');
  console.log(`   ${parsed.hi.title} - ${parsed.hi.artist} (${parsed.hi.year})`);
  console.log(`   YouTube ID: ${parsed.hi.youtube_id || 'MISSING'}`);
  console.log(`   Why: ${parsed.hi.why}`);
}

testOllamaDirectly().catch(console.error);
