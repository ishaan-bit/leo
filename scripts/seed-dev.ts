// Seed development database with test data

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.DATABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function seedPigs() {
  console.log('🌱 Seeding pigs...');

  const testPigs = [
    {
      id: 'a7b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Rosie',
      scan_count: 3,
    },
    {
      id: 'b8c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'Pippin',
      scan_count: 1,
    },
  ];

  for (const pig of testPigs) {
    const { error } = await supabase.from('pigs').upsert(pig);
    if (error) {
      console.error('Error seeding pig:', error);
    } else {
      console.log(`✅ Seeded pig: ${pig.name}`);
    }
  }
}

seedPigs()
  .then(() => {
    console.log('✨ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
