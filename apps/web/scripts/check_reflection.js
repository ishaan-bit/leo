/*
Simple script to fetch a reflection from Upstash using the project's kv helper and
print the parsed object. This avoids needing a running Next dev server.

Usage:
  node scripts/check_reflection.js <rid>

Example:
  node scripts/check_reflection.js refl_1761063801626_cpsu9k65r
*/

const path = require('path');
const { kv } = require('../src/lib/kv');

(async function() {
  const rid = process.argv[2];
  if (!rid) {
    console.error('Usage: node scripts/check_reflection.js <rid>');
    process.exit(2);
  }

  try {
    const key = `reflection:${rid}`;
    const raw = await kv.get(key);
    console.log('RAW KV GET result type:', typeof raw);
    if (!raw) {
      console.log('No value for', key);
      process.exit(0);
    }

    let parsed;
    if (typeof raw === 'string') parsed = JSON.parse(raw);
    else parsed = raw;

    console.log('Parsed reflection:');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
