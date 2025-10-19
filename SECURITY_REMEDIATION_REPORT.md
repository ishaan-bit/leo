# 🔒 Security Remediation Report

**Date**: October 19, 2025  
**Status**: ⚠️ **ACTIVE EXPOSURE - IMMEDIATE ACTION REQUIRED**  
**Severity**: HIGH (Live credentials in public repository)

---

## 1. INVENTORY OF EXPOSED CREDENTIALS

### 1.1 Google Cloud (Project: leo-translation)

| Credential Type | Key Value (First 20 chars) | Exposed In |
|----------------|---------------------------|------------|
| **Google Translate API Key** | `AIzaSyDmPj7YwSjEbrBa...` | ✅ Multiple files |
| **Google OAuth Client ID** | `909743029249-kv27190p...` | ✅ .env.local only (not committed) |
| **Google OAuth Client Secret** | `GOCSPX-5dDCf2L_pumz...` | ✅ .env.local only (not committed) |

**Status**: ⚠️ **Translate API key is in public GitHub commit f6e5496**

### 1.2 Upstash Redis (Project: ultimate-pika-17842)

| Credential Type | Key Value (First 20 chars) | Exposed In |
|----------------|---------------------------|------------|
| **KV_REST_API_TOKEN** (Write) | `AUWyAAIncDI0ZWIwZmY3...` | ✅ .env.local only (not committed) |
| **KV_REST_API_READ_ONLY_TOKEN** | `AkWyAAIgcDLd7qhq27n-...` | ✅ .env.local only (not committed) |
| **REDIS_URL** | `rediss://default:AUWyA...` | ✅ .env.local only (not committed) |

**Status**: ✅ **Not in git history, only in local .env.local (which is .gitignored)**

### 1.3 NextAuth

| Credential Type | Key Value (First 20 chars) | Exposed In |
|----------------|---------------------------|------------|
| **NEXTAUTH_SECRET** | `Rx7JEigIxa1tths7lyZt...` | ✅ .env.local only (not committed) |

**Status**: ✅ **Not in git history**

---

## 2. EXPOSURE ANALYSIS

### 2.1 Files Containing Live Secrets

#### ⚠️ COMMITTED TO GIT (PUBLIC):
1. **`test-translation.js`** (Line 6)
   ```javascript
   const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o';
   ```
   - Commit: `f6e5496` (Oct 19, 2025)
   - Status: **LIVE IN GITHUB** ⚠️
   - Visibility: **PUBLIC REPOSITORY**

2. **`TRANSLATION_SUMMARY.md`** (Lines 116, 124)
   ```markdown
   GOOGLE_TRANSLATE_API_KEY=AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o
   ```
   - Commit: `f6e5496`
   - Status: **LIVE IN GITHUB** ⚠️

3. **`VERCEL_API_KEY_SETUP.md`** (Line 12)
   ```markdown
   - **Value**: `AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o`
   ```
   - Commit: `f6e5496`
   - Status: **LIVE IN GITHUB** ⚠️

#### ✅ NOT COMMITTED (LOCAL ONLY):
- `.env.local` - Properly gitignored, never committed
- All Upstash credentials - Only in .env.local
- Google OAuth secrets - Only in .env.local
- NextAuth secret - Only in .env.local

### 2.2 Public URLs
- **GitHub Repository**: `https://github.com/ishaan-bit/leo`
- **Vercel Deployment**: `https://leo-indol-theta.vercel.app`
- **Build Artifacts**: Need to check Vercel logs and bundles

---

## 3. IMMEDIATE REMEDIATION REQUIRED

### 3.1 Google Translate API Key (CRITICAL)

**Current State**: ⚠️ Exposed in public GitHub repository

**Remediation Steps**:

#### Option A: Keep Same Key (Your Requirement) ✅
1. **Remove from public files** (in next commit)
2. **Restrict key in Google Cloud Console**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click on API key: `AIzaSyDmPj7YwSjEbrBa...`
   - Apply restrictions:
     - **Application restrictions** → HTTP referrers:
       - `https://leo-indol-theta.vercel.app/*`
       - `https://*.vercel.app/*` (for preview deployments)
       - `http://localhost:*/*` (for local dev)
     - **API restrictions** → Restrict key:
       - ✅ Cloud Translation API
       - ❌ All other APIs
   - Save changes
3. **Monitor usage** for next 7 days for anomalies
4. **Use BFG Repo-Cleaner** to remove from git history (optional, but recommended)

#### Option B: Rotate Key (Safer, but you don't want this)
- Create new API key
- Apply restrictions immediately
- Delete old key
- Update Vercel env vars

**Recommendation**: Proceed with Option A but add billing alerts

### 3.2 Upstash Credentials (SAFE - Not Exposed)

**Current State**: ✅ Only in local .env.local (gitignored)

**Additional Hardening** (optional):
1. **Enable IP Allowlist** in Upstash dashboard:
   - Go to: https://console.upstash.com/redis/ultimate-pika-17842
   - Settings → IP Whitelist
   - Add Vercel IPs (if available) or use TLS-only
2. **Use Read-Only Token** where possible:
   - Already separated: `KV_REST_API_READ_ONLY_TOKEN`
   - Use for GET operations only
3. **Enable TLS** (already using `rediss://`)

### 3.3 Google OAuth (SAFE - Not Exposed)

**Current State**: ✅ Only in local .env.local

**Verify Restrictions**:
1. Go to: https://console.cloud.google.com/apis/credentials/oauthclient/909743029249
2. Check **Authorized redirect URIs**:
   - Should only include:
     - `https://leo-indol-theta.vercel.app/api/auth/callback/google`
     - `https://localhost:3000/api/auth/callback/google` (local dev)
3. Check **Authorized JavaScript origins**:
   - `https://leo-indol-theta.vercel.app`
   - `https://localhost:3000`

---

## 4. REMEDIATION ACTIONS

### Step 1: Remove Credentials from Files (IMMEDIATE)

Files to sanitize:
- [ ] `test-translation.js` - Replace hardcoded key with `process.env.GOOGLE_TRANSLATE_API_KEY`
- [ ] `TRANSLATION_SUMMARY.md` - Replace real key with `AIzaSy...REDACTED...`
- [ ] `VERCEL_API_KEY_SETUP.md` - Replace real key with placeholder
- [ ] `TRANSLATION_SETUP.md` - Already sanitized (uses `AIzaSy...`)
- [ ] `TRANSLATION_IMPLEMENTATION.md` - Already sanitized

### Step 2: Commit Sanitized Files

```bash
git add -A
git commit -m "security: Remove exposed Google Translate API key from documentation"
git push origin main
```

### Step 3: Apply API Key Restrictions in Google Cloud

1. Go to: https://console.cloud.google.com/apis/credentials?project=leo-translation
2. Click on the exposed API key
3. Under **Application restrictions**:
   - Select: "HTTP referrers (web sites)"
   - Add referrers:
     ```
     https://leo-indol-theta.vercel.app/*
     https://*.vercel.app/*
     http://localhost:*/*
     ```
4. Under **API restrictions**:
   - Select: "Restrict key"
   - Enable only: "Cloud Translation API"
5. Click **Save**

### Step 4: Set Up Billing Alerts

1. Go to: https://console.cloud.google.com/billing/budgets?project=leo-translation
2. Create budget alert:
   - Budget name: "Translation API Alert"
   - Budget amount: $10/month
   - Alert thresholds: 50%, 90%, 100%
   - Add email notification

### Step 5: Monitor Usage (Next 7 Days)

1. Check usage daily:
   - https://console.cloud.google.com/apis/api/translate.googleapis.com/metrics?project=leo-translation
2. Look for:
   - Unusual spikes in requests
   - Requests from unexpected IPs/referrers (after restrictions applied)
   - Cost anomalies

### Step 6: Clean Git History (Optional but Recommended)

Use BFG Repo-Cleaner to remove secrets from all commits:

```bash
# Install BFG
# Download from: https://rtyley.github.io/bfg-repo-cleaner/

# Create text file with secrets to remove
echo "AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o" > secrets.txt

# Clone fresh copy
git clone --mirror https://github.com/ishaan-bit/leo.git leo-mirror

# Run BFG
java -jar bfg.jar --replace-text secrets.txt leo-mirror

# Push cleaned history (FORCE PUSH - destructive!)
cd leo-mirror
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force

# All collaborators must re-clone
```

**⚠️ WARNING**: This is a destructive operation. All collaborators must re-clone the repository.

---

## 5. VERIFICATION CHECKLIST

### Immediate Verification (After Sanitization)
- [ ] Run `grep -r "AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o" .` - should return 0 results (except .env.local)
- [ ] Check GitHub web UI - files should show `AIzaSy...REDACTED...`
- [ ] Verify .gitignore includes `.env.local`

### Post-Restriction Verification
- [ ] Test API call from allowed domain (https://leo-indol-theta.vercel.app) - should work
- [ ] Test API call from random domain - should fail with 403
- [ ] Test API call with key for other Google APIs - should fail

### Build & Deployment Verification
- [ ] Check Next.js build output - no secrets in bundles
- [ ] Check Vercel logs - no secrets in server logs
- [ ] Check Vercel environment variables UI - secrets properly stored
- [ ] Test preview deployments - work with restricted key

### Secret Scanning
- [ ] Run: `git secrets --scan-history` (if installed)
- [ ] Run: `gitleaks detect --verbose` (if installed)
- [ ] GitHub Secret Scanning alerts - check: https://github.com/ishaan-bit/leo/security

---

## 6. CURRENT RESTRICTIONS (BEFORE REMEDIATION)

### Google Translate API Key
- ❌ **No restrictions** - Can be used from any domain/IP
- ❌ **No API scope limits** - Can access all Google APIs with this project
- ⚠️ **Publicly visible** in GitHub commit history

### Upstash Redis
- ✅ **TLS enforced** - Using `rediss://`
- ✅ **Token separation** - Read-only token available
- ⚠️ **No IP whitelist** - Can be accessed from any IP (but requires token)
- ✅ **Not publicly exposed** - Only in local .env.local

### Google OAuth
- ✅ **Redirect URI restriction** - (need to verify in console)
- ✅ **Not publicly exposed** - Only in local .env.local

---

## 7. POST-REMEDIATION RESTRICTIONS (TARGET STATE)

### Google Translate API Key
- ✅ **HTTP referrer restriction** - Only leo-indol-theta.vercel.app, *.vercel.app, localhost
- ✅ **API scope restriction** - Only Cloud Translation API
- ✅ **Billing alerts** - Alert at $10/month
- ✅ **Removed from public files** - Replaced with placeholders
- ⏳ **Git history** - Optionally cleaned with BFG

### Upstash Redis
- ✅ **TLS enforced**
- ✅ **Token separation** (read-only vs write)
- ✅ **IP whitelist** (if supported by Vercel hosting)
- ✅ **Never publicly exposed**

### Google OAuth
- ✅ **Redirect URI restriction** to production domain
- ✅ **JavaScript origins** restricted
- ✅ **Never publicly exposed**

---

## 8. BILLING & USAGE REVIEW

### Google Cloud Translation API
- **Check**: https://console.cloud.google.com/billing?project=leo-translation
- **Expected usage**: 10,000-50,000 chars/month (~$0)
- **Free tier**: 500,000 chars/month
- **Action**: Review usage for Oct 19-26, 2025 for anomalies

### Upstash Redis
- **Check**: https://console.upstash.com/redis/ultimate-pika-17842
- **Expected usage**: ~10,000 requests/month
- **Free tier**: 10,000 requests/day
- **Action**: Review request patterns for unusual spikes

### Vercel
- **Check**: https://vercel.com/ishaan-bit/leo/usage
- **Expected**: Normal function invocations
- **Action**: Review edge function logs for unusual patterns

---

## 9. RESIDUAL RISKS

### After Remediation (Without History Cleaning)
- ⚠️ **Git history still contains key** in commit f6e5496
- **Mitigation**: API key restrictions prevent abuse from unauthorized domains
- **Risk Level**: MEDIUM (key is restricted but visible)
- **Recommendation**: Clean history with BFG if repository is private

### After Full Remediation (With History Cleaning)
- ✅ **Key removed from all public locations**
- ✅ **Key restricted to specific domains and APIs**
- ✅ **Billing alerts configured**
- **Risk Level**: LOW (standard risk for API key usage)

---

## 10. TIMELINE

| Action | Status | ETA |
|--------|--------|-----|
| Inventory exposed credentials | ✅ Complete | Now |
| Remove credentials from files | ⏳ Pending | 5 minutes |
| Commit and push sanitized files | ⏳ Pending | 10 minutes |
| Apply Google Cloud API restrictions | ⏳ Pending | 15 minutes |
| Set up billing alerts | ⏳ Pending | 20 minutes |
| Verify restrictions work | ⏳ Pending | 25 minutes |
| Monitor usage (ongoing) | ⏳ Pending | 7 days |
| Clean git history (optional) | 🔴 Not started | TBD |

---

## 11. NEXT STEPS (IMMEDIATE)

1. **Acknowledge this report**
2. **Decide on history cleaning**: Keep key in history (with restrictions) or clean history?
3. **Proceed with file sanitization** (I can do this now)
4. **Apply Google Cloud restrictions** (you must do this manually)
5. **Add billing alerts** (you must do this manually)
6. **Monitor for 7 days** (daily check)

---

## 12. LONG-TERM RECOMMENDATIONS

1. **Use secret scanning in CI/CD**:
   - Enable GitHub Secret Scanning: https://github.com/ishaan-bit/leo/settings/security_analysis
   - Add pre-commit hook with `git-secrets`

2. **Rotate secrets quarterly**:
   - Google Translate API key (every 3 months)
   - Upstash tokens (every 6 months)
   - NextAuth secret (every 6 months)

3. **Use secret management service**:
   - Consider Vercel's encrypted environment variables (already using)
   - Consider HashiCorp Vault or AWS Secrets Manager for multi-environment

4. **Audit access logs**:
   - Google Cloud audit logs (weekly)
   - Upstash access logs (weekly)
   - Vercel function logs (daily)

---

## SUMMARY

**Exposed**: Google Translate API key (`AIzaSyDmPj7YwSjEb...`)  
**Location**: Public GitHub repository, 3 files, 1 commit (f6e5496)  
**Safe**: Upstash, Google OAuth, NextAuth (all in gitignored .env.local)  
**Risk**: MEDIUM - Key is public but can be restricted without rotation  
**Action**: Sanitize files → Apply restrictions → Monitor usage  
**ETA**: 25 minutes + 7 days monitoring  

**Ready to proceed with remediation?**
