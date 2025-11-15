#!/usr/bin/env node
/**
 * Nightly Dream Letter Generator
 * Standalone script to generate epistolary dream letters using Mistral AI
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'open-mistral-7b';

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

if (!MISTRAL_API_KEY) {
  console.error('❌ Missing MISTRAL_API_KEY');
  process.exit(1);
}

/**
 * Call Upstash Redis REST API
 */
async function redisCommand(command, ...args) {
  const response = await fetch(`${UPSTASH_URL}/${command}/${args.join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const data = await response.json();
  return data.result;
}

/**
 * Set a key with JSON value (POST request for complex data)
 */
async function redisSet(key, value, expirySeconds = null) {
  const command = expirySeconds ? ['SET', key, value, 'EX', expirySeconds] : ['SET', key, value];
  const response = await fetch(`${UPSTASH_URL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  const data = await response.json();
  return data.result;
}

/**
 * Generate dream letter using Mistral
 */
async function generateDreamLetter(reflections, pigName = 'Leo') {
  const prompt = `You are ${pigName}, a thoughtful pig companion writing an epistolary dream letter to your friend based on their recent reflections.

Recent reflections:
${reflections.map((r, i) => `${i + 1}. "${r.text}" (${r.emotion || 'unknown'})`).join('\n')}

Write a poetic, intimate dream letter (2-3 paragraphs) that:
- Addresses themes from their reflections
- Uses gentle, surreal imagery
- Feels like a letter from a dream
- Signs off as "${pigName}"

Letter:`;

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Main function
 */
async function main() {
  console.log('🌙 Starting nightly dream generator...\n');

  try {
    // Get all user reflection lists
    const userKeys = await redisCommand('KEYS', 'reflections:user:*');
    console.log(`Found ${userKeys?.length || 0} users\n`);

    if (!userKeys || userKeys.length === 0) {
      console.log('No users found. Exiting.');
      return;
    }

    for (const key of userKeys) {
      const userId = key.split(':')[2]; // reflections:user:{userId}
      console.log(`Processing user: ${userId}`);

      // Get user profile to get pig name
      const profileKey = `user:${userId}:profile`;
      const profileData = await redisCommand('GET', profileKey);
      
      let pigName = 'Leo'; // Default fallback
      if (profileData) {
        try {
          const profile = typeof profileData === 'string' ? JSON.parse(profileData) : profileData;
          pigName = profile.pig_name || 'Leo';
          console.log(`  🐷 Pig name from profile: ${pigName}`);
        } catch (err) {
          console.log(`  ⚠️  Could not parse profile, using default name`);
        }
      } else {
        console.log(`  ⚠️  No profile found, checking latest reflection...`);
        
        // FALLBACK: Check latest reflection for pig_name_snapshot
        // (for users created before profile system was implemented)
        const reflectionIds = await redisCommand('ZRANGE', key, '-1', '-1');
        if (reflectionIds && reflectionIds.length > 0) {
          const latestRefl = await redisCommand('GET', `reflection:${reflectionIds[0]}`);
          if (latestRefl) {
            try {
              const reflData = JSON.parse(latestRefl);
              if (reflData.pig_name_snapshot) {
                pigName = reflData.pig_name_snapshot;
                console.log(`  🐷 Pig name from reflection snapshot: ${pigName}`);
                
                // BONUS: Create missing profile for future use
                await redisSet(profileKey, JSON.stringify({
                  pig_name: pigName,
                  created_at: new Date().toISOString(),
                  migrated_from: 'reflection_snapshot'
                }));
                console.log(`  ✅ Created missing profile for future use`);
              }
            } catch (err) {
              console.log(`  ⚠️  Could not parse reflection`);
            }
          }
        }
      }

      // Get user's reflection IDs from sorted set (ZSET)
      const reflectionIds = await redisCommand('ZRANGE', key, '0', '-1');
      
      if (!reflectionIds || reflectionIds.length === 0) {
        console.log(`  ⏭️  No reflections, skipping\n`);
        continue;
      }

      // Fetch reflection data
      const reflections = [];
      for (const rid of reflectionIds.slice(0, 5)) { // Limit to 5 most recent
        const refl = await redisCommand('GET', `reflection:${rid}`);
        if (refl) {
          const data = JSON.parse(refl);
          reflections.push({
            text: data.normalized_text || data.text,
            emotion: data.final?.wheel?.primary
          });
        }
      }

      if (reflections.length === 0) {
        console.log(`  ⏭️  No valid reflections, skipping\n`);
        continue;
      }

      console.log(`  📝 Found ${reflections.length} reflections`);

      // Generate dream letter
      console.log(`  🤖 Generating dream letter with Mistral (signed as ${pigName})...`);
      const letter = await generateDreamLetter(reflections, pigName);

      // Save to pending_dream key
      const dreamData = {
        letter_text: letter,
        created_at: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      };

      const ttl = 14 * 24 * 60 * 60; // 14 days in seconds
      await redisSet(`user:${userId}:pending_dream`, JSON.stringify(dreamData), ttl);
      console.log(`  ✅ Dream letter saved\n`);
    }

    console.log('🎉 All done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
