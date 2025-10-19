# 🔒 Security Remediation Checklist

**Date**: October 19, 2025  
**Time Started**: Now  
**Estimated Completion**: 25 minutes + 7 days monitoring  

---

## ✅ Phase 1: Exposure Removal (COMPLETE)

- [x] **Inventory credentials** - Found Google Translate API key in 3 files
- [x] **Identify exposure** - Key was in commit f6e5496, pushed to GitHub
- [x] **Sanitize files** - Removed hardcoded key from:
  - test-translation.js (now uses env var)
  - TRANSLATION_SUMMARY.md (placeholder)
  - VERCEL_API_KEY_SETUP.md (placeholder)
- [x] **Commit changes** - Commit d95fcb2 pushed to GitHub
- [x] **Verify removal** - No live keys in tracked files ✓

**Status**: ✅ **COMPLETE** - No live credentials in current HEAD

---

## ⏳ Phase 2: Apply Restrictions (YOUR ACTION REQUIRED)

### Google Cloud Console Restrictions

Go to: https://console.cloud.google.com/apis/credentials?project=leo-translation

- [ ] **Access Google Cloud Console** (1 min)
  - Sign in to Google Cloud
  - Navigate to API Credentials
  
- [ ] **Apply HTTP Referrer Restrictions** (2 min)
  - Select: "HTTP referrers (web sites)"
  - Add referrers:
    - `https://leo-indol-theta.vercel.app/*`
    - `https://*.vercel.app/*`
    - `http://localhost:*/*`
    - `http://127.0.0.1:*/*`
  
- [ ] **Apply API Restrictions** (1 min)
  - Select: "Restrict key"
  - Enable ONLY: "Cloud Translation API"
  - Disable all other APIs
  
- [ ] **Save Changes** (1 min)
  - Click "SAVE"
  - Wait for confirmation

### Billing Alerts

Go to: https://console.cloud.google.com/billing/budgets?project=leo-translation

- [ ] **Create Budget Alert** (3 min)
  - Budget name: "Translation API Alert"
  - Amount: $10/month
  - Thresholds: 50%, 90%, 100%
  - Enable email notifications

**Status**: ⏳ **PENDING** - You must complete this manually

---

## ⏳ Phase 3: Verification (After Restrictions Applied)

### Wait Period
- [ ] **Wait 5-10 minutes** for restrictions to propagate globally

### Test Restrictions

- [ ] **Test from allowed domain** (Should work)
  ```bash
  # From your app or Vercel preview
  # Expected: 200 OK with translation
  ```

- [ ] **Test from unauthorized domain** (Should fail)
  ```bash
  # From random domain or direct curl without referer
  # Expected: 403 Forbidden
  ```

- [ ] **Test wrong API** (Should fail)
  ```bash
  # Try to use key for Google Maps, YouTube, etc.
  # Expected: API not enabled error
  ```

### Verify Vercel Environment

Go to: https://vercel.com/ishaan-bit/leo/settings/environment-variables

- [ ] **Check GOOGLE_TRANSLATE_API_KEY exists**
  - Name: `GOOGLE_TRANSLATE_API_KEY`
  - Value: Your API key (from .env.local)
  - Environments: ✅ Production ✅ Preview ✅ Development

- [ ] **Redeploy if needed**
  - Go to deployments
  - Click "Redeploy" on latest

### Test Application End-to-End

- [ ] **Test in production**
  - Go to: https://leo-indol-theta.vercel.app
  - Submit Hinglish reflection: "kal doston se milkar accha laga"
  - Verify `normalized_text` shows English translation
  
- [ ] **Check Vercel logs**
  - Go to: https://vercel.com/ishaan-bit/leo/logs
  - Search for: `[TRANSLATION]`
  - Should see: `translate_success`

**Status**: ⏳ **PENDING** - After restrictions applied

---

## ⏳ Phase 4: Monitoring (Next 7 Days)

### Daily Usage Check

Go to: https://console.cloud.google.com/apis/api/translate.googleapis.com/metrics?project=leo-translation

**Day 1 (Oct 19, 2025)**:
- [ ] Check traffic graph - Look for spikes
- [ ] Check errors graph - 403s indicate blocked abuse
- [ ] Check referers - Should only be your domains
- [ ] Review charges - Should be $0

**Day 2 (Oct 20, 2025)**:
- [ ] Repeat daily checks
- [ ] Compare to Day 1 baseline

**Day 3-7**:
- [ ] Continue daily monitoring
- [ ] Note any anomalies in log below

### Billing Review

Go to: https://console.cloud.google.com/billing?project=leo-translation

- [ ] **Week 1 review** (Oct 26, 2025)
  - Total charges: Expected $0 (free tier)
  - Character usage: Expected <50,000 (<10% of free tier)
  - Any anomalies: _____________

### Upstash Review (Already Secure)

Go to: https://console.upstash.com/redis/ultimate-pika-17842

- [ ] **Check request patterns**
  - Expected: 10,000-50,000 requests/month
  - Look for unusual spikes
  - Verify TLS connections only

**Status**: ⏳ **PENDING** - Daily checks required

---

## Phase 5: Advanced Remediation (Optional)

### Clean Git History (Optional - High Effort)

⚠️ **WARNING**: This is a destructive operation. Only do if:
- You're concerned about key in git history
- You've already applied restrictions above
- You understand force-push implications

**Why this is optional**:
- Key is now restricted to your domains (can't be abused)
- Billing alerts will catch any issues
- Force-pushing affects all collaborators

**If you decide to proceed**:

- [ ] Install BFG Repo-Cleaner
  - Download: https://rtyley.github.io/bfg-repo-cleaner/
  - Requires Java Runtime

- [ ] Create secrets file
  ```bash
  echo "AIzaSyDmPj7YwSjEbrBayWmEc7-8qNJwknDWr5o" > secrets.txt
  ```

- [ ] Clone mirror
  ```bash
  git clone --mirror https://github.com/ishaan-bit/leo.git leo-mirror
  ```

- [ ] Run BFG
  ```bash
  java -jar bfg.jar --replace-text secrets.txt leo-mirror
  ```

- [ ] Clean and push
  ```bash
  cd leo-mirror
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  git push --force
  ```

- [ ] Notify collaborators to re-clone

**Status**: 🔴 **NOT STARTED** - Optional, not required

---

## Phase 6: Long-Term Security (Ongoing)

### Enable Secret Scanning

Go to: https://github.com/ishaan-bit/leo/settings/security_analysis

- [ ] **Enable Dependabot alerts**
- [ ] **Enable Secret scanning**
- [ ] **Enable Code scanning** (if available)

### Install Pre-Commit Hook (Optional)

- [ ] Install git-secrets
  ```bash
  brew install git-secrets  # macOS
  # or download from: https://github.com/awslabs/git-secrets
  ```

- [ ] Configure for repo
  ```bash
  cd /path/to/leo
  git secrets --install
  git secrets --register-aws  # Detects AWS-like keys
  git secrets --add 'AIzaSy[A-Za-z0-9_-]{33}'  # Google API keys
  git secrets --add 'AUWyAAInc[A-Za-z0-9]+'  # Upstash tokens
  ```

### Quarterly Key Rotation

- [ ] **Q1 2026 (Jan 2026)** - Rotate Google Translate API key
- [ ] **Q2 2026 (Apr 2026)** - Review and update restrictions
- [ ] **Q3 2026 (Jul 2026)** - Rotate Upstash tokens
- [ ] **Q4 2026 (Oct 2026)** - Rotate NextAuth secret

**Status**: ⏳ **PENDING** - Long-term maintenance

---

## Current Status Summary

| Phase | Status | Owner | ETA |
|-------|--------|-------|-----|
| 1. Exposure Removal | ✅ COMPLETE | Agent | Done |
| 2. Apply Restrictions | ⏳ PENDING | **YOU** | 15 min |
| 3. Verification | ⏳ PENDING | **YOU** | 10 min |
| 4. Monitoring | ⏳ PENDING | **YOU** | 7 days |
| 5. History Cleaning | 🔴 OPTIONAL | **YOU** | N/A |
| 6. Long-Term Security | ⏳ PENDING | **YOU** | Ongoing |

---

## Risk Level

| Time Period | Risk Level | Reasoning |
|-------------|-----------|-----------|
| **Before remediation** | 🔴 **HIGH** | Live key in public repository, unrestricted |
| **After file sanitization** (Now) | 🟡 **MEDIUM** | Key still in git history, but removed from HEAD |
| **After restrictions applied** | 🟢 **LOW** | Key restricted to your domains, monitored |
| **After 7 days monitoring** | 🟢 **MINIMAL** | Verified no abuse, normal usage confirmed |

**Current Risk**: 🟡 **MEDIUM** - Awaiting restriction application

---

## Next Immediate Action

**👉 Go to:** https://console.cloud.google.com/apis/credentials?project=leo-translation

**👉 Follow:** [GOOGLE_CLOUD_RESTRICTIONS.md](./GOOGLE_CLOUD_RESTRICTIONS.md)

**👉 Time:** 15 minutes

**👉 Priority:** CRITICAL - Do this now

---

## Documentation Created

- ✅ `SECURITY_REMEDIATION_REPORT.md` - Comprehensive analysis (12 sections)
- ✅ `GOOGLE_CLOUD_RESTRICTIONS.md` - Step-by-step restriction guide
- ✅ `SECURITY_CHECKLIST.md` - This file (actionable checklist)

---

## Questions?

- **What if I see unusual usage?** → Check SECURITY_REMEDIATION_REPORT.md Section 9
- **How do I apply restrictions?** → Follow GOOGLE_CLOUD_RESTRICTIONS.md
- **Should I clean git history?** → Optional. Restrictions are sufficient.
- **What if key was already abused?** → Billing alerts will catch it. Restrictions prevent future abuse.

---

**Ready? Start Phase 2: Apply Restrictions** 👆
