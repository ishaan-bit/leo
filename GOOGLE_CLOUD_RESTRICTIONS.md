# 🔒 Google Cloud API Key Restriction Guide

**CRITICAL**: Apply these restrictions **immediately** to secure the exposed Google Translate API key.

---

## Step-by-Step Instructions

### Step 1: Access Google Cloud Console

1. Go to: **https://console.cloud.google.com/apis/credentials?project=leo-translation**
2. Sign in with your Google account
3. Locate your API key in the list (should show: "API key created...")

### Step 2: Edit API Key

1. Click on the **API key name** (or the pencil icon)
2. You'll see the "Edit API key" page

### Step 3: Apply Application Restrictions

Under **"Application restrictions"** section:

1. Select: **"HTTP referrers (web sites)"**

2. Click **"ADD AN ITEM"** and add these referrers (one per line):

   ```
   https://leo-indol-theta.vercel.app/*
   https://*.vercel.app/*
   http://localhost:*/*
   http://127.0.0.1:*/*
   ```

3. **What this does**:
   - ✅ Allows: Vercel production deployment
   - ✅ Allows: Vercel preview deployments
   - ✅ Allows: Local development (localhost)
   - ❌ Blocks: All other domains (including abuse from scraped key)

### Step 4: Apply API Restrictions

Under **"API restrictions"** section:

1. Select: **"Restrict key"** (instead of "Don't restrict key")

2. Click dropdown: **"Select APIs"**

3. Search for and select **ONLY**:
   - ✅ **Cloud Translation API**

4. Uncheck all other APIs

5. **What this does**:
   - ✅ Can only use Google Translate
   - ❌ Cannot access Google Maps, YouTube, etc. (prevents misuse)

### Step 5: Save Changes

1. Scroll to bottom
2. Click **"SAVE"** button
3. Wait for confirmation message: "API key updated successfully"

### Step 6: Verify Restrictions

1. Go back to credentials list: https://console.cloud.google.com/apis/credentials?project=leo-translation
2. Click on your API key again
3. Verify:
   - **Application restrictions**: Shows "HTTP referrers" with your domains
   - **API restrictions**: Shows "Cloud Translation API"

---

## Step 7: Set Up Billing Alerts (Recommended)

### Create Budget Alert

1. Go to: **https://console.cloud.google.com/billing/budgets?project=leo-translation**

2. Click **"CREATE BUDGET"**

3. **Scope** section:
   - Projects: Select "leo-translation"
   - Services: Select "All services" or just "Cloud Translation API"
   - Click "NEXT"

4. **Amount** section:
   - Budget type: "Specified amount"
   - Target amount: **$10** (well above free tier, but safe)
   - Click "NEXT"

5. **Actions** section:
   - Alert threshold rules:
     - 50% of budget ($5)
     - 90% of budget ($9)
     - 100% of budget ($10)
   - Check: ✅ Email alerts to project billing admins
   - Optionally: Add your email address
   - Click "FINISH"

6. **What this does**:
   - You'll be notified if usage exceeds free tier (500K chars = $0)
   - Alerts if someone abuses the key before restrictions propagate
   - Peace of mind monitoring

---

## Step 8: Test Restrictions (After ~5 Minutes)

### Test 1: Allowed Domain (Should Work)

```bash
# From Vercel deployment
curl -X POST "https://translation.googleapis.com/language/translate/v2?key=YOUR_KEY" \
  -H "Referer: https://leo-indol-theta.vercel.app/" \
  -H "Content-Type: application/json" \
  -d '{"q":"hello","target":"es"}'
```

**Expected**: ✅ Returns translation (200 OK)

### Test 2: Unauthorized Domain (Should Fail)

```bash
# From random domain
curl -X POST "https://translation.googleapis.com/language/translate/v2?key=YOUR_KEY" \
  -H "Referer: https://evil.com/" \
  -H "Content-Type: application/json" \
  -d '{"q":"hello","target":"es"}'
```

**Expected**: ❌ Returns 403 Forbidden: "API key not valid. Please pass a valid API key."

### Test 3: Wrong API (Should Fail)

```bash
# Try to use key for Google Maps
curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=YOUR_KEY"
```

**Expected**: ❌ Returns error about API not enabled

---

## Step 9: Monitor Usage

### Daily Monitoring (Next 7 Days)

1. Go to: **https://console.cloud.google.com/apis/api/translate.googleapis.com/metrics?project=leo-translation**

2. Check:
   - **Traffic** graph: Look for unusual spikes
   - **Errors** graph: Should see 403 errors from blocked requests (if key was used)
   - **Latency** graph: Should be normal (100-500ms)

3. Look for anomalies:
   - ⚠️ Sudden spike in requests (indicates abuse)
   - ⚠️ Many 403 errors (indicates blocked abuse attempts - good!)
   - ⚠️ Requests outside your usage patterns

### Weekly Monitoring (Ongoing)

1. Check billing: https://console.cloud.google.com/billing?project=leo-translation
2. Verify charges: Should be $0 if under 500K chars/month
3. Review usage trends: Should align with your reflection submission patterns

---

## Step 10: Update Vercel Environment Variable

Since you're keeping the same key, verify it's in Vercel:

1. Go to: **https://vercel.com/ishaan-bit/leo/settings/environment-variables**

2. Find: `GOOGLE_TRANSLATE_API_KEY`

3. If missing, add it:
   - Click "Add New"
   - Name: `GOOGLE_TRANSLATE_API_KEY`
   - Value: Your API key (from .env.local)
   - Environments: ✅ Production ✅ Preview ✅ Development
   - Click "Save"

4. If already exists:
   - Click "Edit"
   - Verify value matches your key
   - Verify all environments selected
   - Click "Save"

5. **Redeploy** (if you changed anything):
   - Go to: https://vercel.com/ishaan-bit/leo/deployments
   - Click "..." on latest deployment
   - Click "Redeploy"

---

## Verification Checklist

After completing all steps:

- [ ] API key has HTTP referrer restrictions (only your domains)
- [ ] API key restricted to Cloud Translation API only
- [ ] Billing alerts configured ($10 budget with 50%, 90%, 100% thresholds)
- [ ] Tested key from allowed domain - works ✅
- [ ] Tested key from unauthorized domain - fails ✅
- [ ] Tested key for wrong API - fails ✅
- [ ] Vercel environment variable is set correctly
- [ ] Monitoring dashboard bookmarked for daily checks
- [ ] Usage patterns reviewed (no anomalies in last 24 hours)

---

## Timeline

| Task | Time | Status |
|------|------|--------|
| Access Google Cloud Console | 1 min | ⏳ |
| Apply HTTP referrer restrictions | 2 min | ⏳ |
| Apply API restrictions | 1 min | ⏳ |
| Set up billing alerts | 3 min | ⏳ |
| Wait for propagation | 5 min | ⏳ |
| Test restrictions | 5 min | ⏳ |
| Monitor usage (daily) | 2 min/day | ⏳ |
| **Total** | **~17 min + monitoring** | |

---

## What If Someone Already Used the Key?

If you see unusual usage in the metrics:

### Immediate Actions:
1. **Don't panic** - You have billing alerts
2. **Check current charges**: https://console.cloud.google.com/billing?project=leo-translation
3. **Review request logs**: Check for suspicious referers/IPs
4. **Restrictions will block future abuse** once applied

### If Charges are High:
1. **Disable the API temporarily**:
   - Go to: https://console.cloud.google.com/apis/api/translate.googleapis.com/overview?project=leo-translation
   - Click "DISABLE API"
   - Create new key with restrictions
   - Enable API again
2. **Contact Google Cloud support** if charges are unexpected

### If Usage Looks Normal:
1. ✅ Proceed with restrictions
2. ✅ Monitor for next 7 days
3. ✅ Should be fine (key was only exposed for ~1 hour)

---

## Expected Usage Patterns (Baseline)

After restrictions, your normal usage should look like:

- **Requests/day**: 10-50 (depending on reflection submissions)
- **Characters/month**: 10,000-50,000 (well under 500K free tier)
- **Cost**: $0.00
- **Referers**: Only `leo-indol-theta.vercel.app` and `*.vercel.app`
- **Success rate**: >99% (few 4xx errors)

Any deviation from this indicates either:
- 📈 Your app is getting more users (good!)
- ⚠️ Someone is attempting to use the key (blocked by restrictions)

---

## Long-Term Security

### Quarterly Review (Every 3 Months):
1. Rotate the API key (create new, delete old)
2. Review and update referrer restrictions
3. Audit usage patterns
4. Update billing alerts if needed

### Best Practices:
- ✅ Never commit API keys to git
- ✅ Always use environment variables
- ✅ Apply restrictions immediately after creating keys
- ✅ Monitor usage regularly
- ✅ Use billing alerts
- ✅ Rotate keys periodically

---

## Need Help?

If you encounter issues:

1. **Google Cloud Console issues**: Check https://console.cloud.google.com/support
2. **Restrictions not working**: Wait 5-10 minutes for propagation
3. **Billing questions**: https://console.cloud.google.com/billing/support
4. **Key compromised**: Disable API, create new key, update Vercel

---

## Summary

**Time**: 17 minutes  
**Cost**: $0 (within free tier)  
**Risk reduction**: HIGH → LOW  
**Effort**: One-time setup + 2 min/day monitoring  

**Your API key will be secure from abuse while remaining fully functional for your application.**

Ready? Go to: https://console.cloud.google.com/apis/credentials?project=leo-translation
