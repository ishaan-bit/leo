# Leo Reflection Database Setup

Complete guide to set up data persistence for Leo reflections using Supabase.

## 📋 Overview

The system saves:
- **Reflections**: User writings with behavioral signals (valence, arousal, language, etc.)
- **Pigs**: Physical pig QR IDs, names, ownership
- **Session links**: Maps guest sessions → user accounts

## 🚀 Quick Setup (5 minutes)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose a name (e.g., "leo-production")
4. Set a strong database password
5. Select a region close to your users
6. Wait for project to provision (~2 minutes)

### 2. Run Database Migration

1. Open your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy the entire contents of `supabase-schema.sql`
5. Paste into the editor
6. Click "Run" (bottom right)
7. You should see "Success. No rows returned"

**What this creates:**
- `reflections` table - All user writings
- `pigs` table - Pig metadata
- `session_user_links` table - Guest→User migrations
- Indexes for fast queries
- Helper functions for analytics

### 3. Get Your API Keys

1. In Supabase dashboard, go to Settings → API
2. Copy your **Project URL** (looks like `https://xxx.supabase.co`)
3. Copy your **anon public** key (starts with `eyJ...`)

### 4. Configure Environment Variables

1. Copy `.env.local.template` to `.env.local`:
   ```bash
   cp .env.local.template .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key
   ```

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

### 5. Test It!

1. Visit `http://localhost:3000/p/testpig`
2. Write a reflection and submit
3. Check your terminal - you should see:
   ```
   💾 Reflection saved: { id: 'xxx', ownerId: 'guest:sess_...', ... }
   ```
4. Visit `http://localhost:3000/admin/reflections` to see your data!

---

## 📊 Data Model

### Reflections Table

Stores every reflection with full context:

```typescript
{
  // Identity (who owns this?)
  owner_id: "guest:{sessionId}" | "user:{userId}",
  user_id: "google_123456789" | null,
  session_id: "sess_abc123",
  signed_in: true | false,
  
  // Pig context
  pig_id: "testpig",
  pig_name: "Fury",
  
  // Content
  text: "Dear Fury, today I feel...",
  feeling_seed: null,  // Future: result of ritual
  
  // Behavioral signals
  valence: 0.5,        // -1.0 (negative) to 1.0 (positive)
  arousal: 0.7,        // 0.0 (calm) to 1.0 (energized)
  language: "en",      // Detected language
  input_mode: "typing" | "voice",
  time_of_day: "morning" | "noon" | "evening" | "night",
  
  // Metadata
  metrics: { /* typing speed, pauses, etc */ },
  device_info: {
    type: "mobile" | "tablet" | "desktop",
    platform: "iOS" | "Android" | "Windows" | etc,
    locale: "en-US",
    timezone: "America/New_York"
  },
  
  // Timestamps
  created_at: "2025-10-18T12:34:56Z",
  
  // Privacy
  consent_research: true
}
```

### Pigs Table

Tracks physical pigs:

```typescript
{
  pig_id: "testpig",           // QR code ID
  pig_name: "Fury",            // User-given name
  owner_id: "user:google_123", // Current owner
  created_at: "2025-10-18T10:00:00Z",
  named_at: "2025-10-18T10:05:00Z",
  last_reflection_at: "2025-10-18T12:34:56Z"
}
```

### Session→User Links

Tracks migrations when guests sign in:

```typescript
{
  session_id: "sess_abc123",
  user_id: "google_123456789",
  linked_at: "2025-10-18T12:00:00Z",
  migration_completed: true
}
```

---

## 🔄 Data Flow

### Guest User Journey

1. **First Visit** → Creates `session_id` in localStorage
2. **Writes Reflection** → Saved as `owner_id: "guest:{sessionId}"`
3. **Signs In** → Links `session_id` to `user_id`
4. **Migration** → All `guest:{sessionId}` reflections updated to `user:{userId}`

### Signed-In User Journey

1. **Already Signed In** → Uses `user_id` from NextAuth session
2. **Writes Reflection** → Saved as `owner_id: "user:{userId}"` immediately
3. **No Migration Needed** → Data already belongs to user account

---

## 📱 Viewing Your Data

### Admin Dashboard

Visit `/admin/reflections` to see:
- All saved reflections
- Filter by guest/user
- Search by pig ID
- Stats: total count, avg valence, etc.
- Device breakdown

### Supabase Dashboard

1. Go to Table Editor
2. Click `reflections` table
3. See all rows with full data
4. Can export to CSV

### SQL Queries

Run custom queries in Supabase SQL Editor:

```sql
-- Get all reflections for a user
SELECT * FROM reflections 
WHERE owner_id = 'user:google_123456789'
ORDER BY created_at DESC;

-- Average valence by time of day
SELECT time_of_day, AVG(valence) as avg_valence, COUNT(*) as count
FROM reflections
GROUP BY time_of_day;

-- Most active pigs
SELECT pig_id, pig_name, COUNT(*) as reflection_count
FROM reflections
GROUP BY pig_id, pig_name
ORDER BY reflection_count DESC
LIMIT 10;
```

---

## 🔒 Privacy & Security

### What We Save

✅ **Saved:**
- Reflection text (user's own words)
- Behavioral signals (valence, arousal, etc.)
- Device type & platform (for UX optimization)
- Timestamps & pig context

❌ **NOT Saved:**
- User's email address (only auth provider ID)
- IP addresses
- Browsing history
- Personal identifiable info beyond Google ID

### GDPR Compliance

Users can request deletion:

```typescript
import { deleteReflectionsByOwner } from '@/lib/reflection-service';

// Delete all reflections for a user
await deleteReflectionsByOwner('user:google_123456789');
```

### Row Level Security (RLS)

Currently set to permissive for development. **Before production:**

1. Update RLS policies in Supabase
2. Restrict queries to owner's own data
3. Use service role key for admin operations

---

## 🛠️ Troubleshooting

### "Cannot find module '@/lib/supabase'"

- Make sure you ran `npm install` after pulling latest code
- Restart your IDE/editor
- Check that `src/lib/supabase.ts` exists

### "Missing Supabase environment variables"

- Check that `.env.local` exists (not `.env.local.template`)
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart dev server after adding env vars

### Reflections not saving

1. Check browser console for errors
2. Check terminal logs for `💾 Reflection saved` message
3. Verify Supabase tables exist (run migration again if needed)
4. Check Supabase dashboard → Logs for errors

### "Row Level Security" errors

Run this in Supabase SQL Editor to make tables publicly accessible (dev only):

```sql
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all reflections operations" ON reflections;
CREATE POLICY "Allow all reflections operations" ON reflections FOR ALL USING (true);

ALTER TABLE pigs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all pigs operations" ON pigs;
CREATE POLICY "Allow all pigs operations" ON pigs FOR ALL USING (true);

ALTER TABLE session_user_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all session links operations" ON session_user_links;
CREATE POLICY "Allow all session links operations" ON session_user_links FOR ALL USING (true);
```

---

## 🚢 Production Deployment

### Environment Variables on Vercel

1. Go to Vercel dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Redeploy

### Separate Dev/Production Databases

Create two Supabase projects:
- `leo-development` - For local testing
- `leo-production` - For live site

Use different `.env.local` values locally vs Vercel.

---

## 📈 Next Steps

### Analytics Queries

Get insights from your data:

```sql
-- Reflections over time
SELECT DATE(created_at) as date, COUNT(*) 
FROM reflections 
GROUP BY date 
ORDER BY date DESC;

-- Language distribution
SELECT language, COUNT(*) 
FROM reflections 
GROUP BY language;

-- Device types
SELECT device_info->>'type' as device_type, COUNT(*)
FROM reflections
GROUP BY device_type;
```

### Future Enhancements

- [ ] Add search/filtering in admin dashboard
- [ ] Export reflections to CSV
- [ ] Visualize valence/arousal trends over time
- [ ] Add sentiment analysis
- [ ] Multi-language support analytics
- [ ] User-facing "My Reflections" page

---

## 📞 Support

If you get stuck:
1. Check the troubleshooting section above
2. Review Supabase logs in dashboard
3. Check browser console for errors
4. Verify environment variables are set correctly

---

**You're all set! 🎉** Visit `/p/testpig` and start collecting beautiful, meaningful data. ✨
