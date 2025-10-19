# 🎯 Quick Start - Reflection Analysis Agent

## Setup (5 minutes)

### 1. Set Upstash Credentials
Get these from your Vercel project or Upstash console:

```powershell
# PowerShell
$env:UPSTASH_REDIS_REST_URL="https://YOUR_URL.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN="YOUR_TOKEN_HERE"
```

Or find them in Vercel:
```powershell
cd apps/web
vercel env pull .env.local
# Then copy UPSTASH values to PowerShell env vars
```

### 2. Install Python Dependencies
```powershell
cd behavioral-backend
pip install -r requirements.txt
```

### 3. Test Connection
```powershell
python test_upstash_connection.py
```

Expected: `✓ Connected to Upstash`

## Usage

### Create & Analyze a Reflection

#### Step 1: Go to your Vercel app
```powershell
cd apps/web
npm run dev
```

#### Step 2: Submit a reflection
- Open http://localhost:3000 (or your Vercel URL)
- Find a pig, enter a reflection:
  ```
  Kafi Dinon bad Doston Se Milkar bahut Achcha Laga
  ```
- Submit

#### Step 3: Get the Reflection ID
- Check browser console or Network tab
- Look for response from `/api/reflect`
- Note the `rid` value (e.g., `refl_1760853676002_pxv98fkpp`)

#### Step 4: Enrich with Analysis
```powershell
cd behavioral-backend
python enrich_reflection.py refl_YOUR_ID_HERE
```

#### Step 5: Verify in Upstash
- Go to https://console.upstash.com/
- Open your Redis database
- Search for: `reflection:refl_YOUR_ID_HERE`
- You should see the `analysis` block!

## What You Get

Every reflection is enriched with:
- ✅ **Event extraction** - What happened
- ✅ **Emotion analysis** - Willcox wheel mapping
- ✅ **Self-awareness scores** - Clarity, depth, authenticity
- ✅ **Temporal features** - Momentum, z-scores, seasonality
- ✅ **Risk detection** - Self-harm, hopelessness flags
- ✅ **Event chaining** - Links to similar past reflections
- ✅ **Insights** - Personalized recommendations

## Troubleshooting

### "UPSTASH env vars not set"
```powershell
# Set them:
$env:UPSTASH_REDIS_REST_URL="your_url"
$env:UPSTASH_REDIS_REST_TOKEN="your_token"

# Verify:
echo $env:UPSTASH_REDIS_REST_URL
```

### "Reflection not found"
- Make sure you submitted a reflection first
- Check the RID is correct
- Verify in Upstash console that the reflection exists

### "Module not found"
```powershell
pip install -r requirements.txt
```

## Files You Need

✅ All created and ready:
- `agent_service.py` - Main analysis engine
- `enrich_reflection.py` - CLI tool
- `test_upstash_connection.py` - Connection tester
- `src/persistence.py` - Upstash operations
- `apps/web/app/api/reflect/route.ts` - Frontend API
- `apps/web/app/api/reflect/analyze/route.ts` - Analysis webhook

## Next Steps

1. **Test locally**: Follow steps above
2. **Deploy to Vercel**: The analyze endpoint is ready
3. **Add automation**: Set up queue/webhook for auto-enrichment
4. **Enhance NLP**: Replace rules with ML models

---

**Ready to go!** Start with setting the env vars and testing the connection.

See `REFLECTION_ANALYSIS_COMPLETE.md` for full details.
