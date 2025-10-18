# Upstash Redis Setup Guide (Vercel Marketplace)

## What is Upstash Redis?
Upstash Redis is a serverless Redis database available through Vercel Marketplace. It replaced Vercel's native KV in June 2025.

Data persists across:
- ✅ Serverless function invocations
- ✅ Different browsers and devices
- ✅ User sessions (data tied to pigId, not user)

This is **critical** for Leo because pig names are tied to QR codes (pigId), not user accounts.

## Setup Steps

### 1. Install Upstash from Vercel Marketplace

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **leo** project
3. Click **Marketplace** or **Integrations** tab in the sidebar
4. Search for **"Upstash"** or filter by **Storage** category
5. Click on **Upstash** (Serverless Redis)
6. Click **Add** or **Install**

### 2. Configure the Database

1. **Database Name**: Enter `leo-pig-storage` (or any name you like)
2. **Region**: Select **Singapore** or closest to India for better performance
3. **Connect to Project**: Select your **leo** project
4. Click **Create Database**

### 3. Automatic Environment Variables

Vercel will automatically add these environment variables to your project:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 4. Deploy

Your next deployment will automatically have access to Redis!

```bash
git add .
git commit -m "Update to Upstash Redis (Vercel Marketplace)"
git push origin main
```

Vercel will auto-deploy with Redis configured ✨

## Local Development

For local development without Redis configured, the app falls back to in-memory storage (data resets on restart).

If you want to test Redis locally:

1. Copy Redis variables from Vercel Dashboard → Settings → Environment Variables
2. Add to `apps/web/.env.local`:
   ```bash
   UPSTASH_REDIS_REST_URL=your-redis-url
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

## How It Works

### Storage Schema
```
Key: pig:{pigId}
Value: { name: string, namedAt: string }
```

### Example
```typescript
// Save a pig name
await savePigName('abc123', 'Rosie');
// Stored as: pig:abc123 → { name: 'Rosie', namedAt: '2025-10-18T...' }

// Get pig name (from any device, any browser)
const name = await getPigName('abc123');
// Returns: 'Rosie'
```

### Flow
1. User scans QR → `/p/abc123`
2. User names pig "Rosie" → saved to KV with key `pig:abc123`
3. User clicks "Continue as Guest" → redirects to `/reflect/abc123`
4. Reflect page fetches from KV → gets "Rosie"
5. **User scans same QR on different device** → gets "Rosie" (persisted!)

## Cost

- **Free tier**: 10,000 commands/day
- **Pay as you go**: $0.20 per 100,000 commands
- For Leo's expected usage (naming + reflecting), free tier is plenty

## Testing

After deployment with Redis:

1. Go to `https://leo-indol-theta.vercel.app/p/testpig2`
2. Name the pig "Rosie"
3. Click "Continue as Guest"
4. Should load reflect page with "Rosie"
5. **Open in different browser** → go to `/reflect/testpig2` → should still show "Rosie" ✨

## Troubleshooting

If pig names aren't persisting:

1. Check Vercel Dashboard → Integrations → ensure Upstash is installed
2. Check Project Settings → Environment Variables → ensure Redis vars are set
3. Check deployment logs for Redis connection errors
4. Verify `UPSTASH_REDIS_REST_URL` is set (required for production)
