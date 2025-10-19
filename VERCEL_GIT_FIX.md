# Fix Vercel Git Auto-Deploy

## Problem
Vercel stopped auto-deploying when code is pushed to GitHub (started ~2 hours ago, was working before).

## Check These Settings

### 1. Git Integration
Go to: Vercel Dashboard → leo project → Settings → Git

**Check:**
- Is GitHub connected? (Should show `ishaan-bit/leo`)
- Production Branch: `main` ✓
- If disconnected, click "Connect Git Repository" and reconnect

### 2. Ignored Build Step
Go to: Vercel Dashboard → leo project → Settings → Git → Ignored Build Step

**Should be:** Empty or default (`git diff HEAD^ HEAD --quiet`)

**If it says something else,** it might be ignoring all builds. Set it back to default.

### 3. GitHub App Permissions
Go to: GitHub → Settings → Applications → Vercel

**Check:**
- Vercel has access to `ishaan-bit/leo` repository
- Repository access is not "None" or revoked

### 4. Webhook
Go to: GitHub → ishaan-bit/leo → Settings → Webhooks

**Check:**
- There's a webhook for `vercel.com`
- Recent Deliveries show successful (200) responses
- If failing, delete and re-add webhook (Vercel will recreate it)

## Quick Fix: Reconnect Git

1. Vercel Dashboard → leo → Settings → Git
2. Click "Disconnect" (if connected)
3. Click "Connect Git Repository"
4. Select GitHub → ishaan-bit/leo → main branch
5. Push a new commit to test

## Alternative: Force Deploy on Every Push

In your repo, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

This will trigger Vercel deployment via GitHub Actions instead of Vercel's native Git integration.

## Current Workaround

Until fixed, manually click "Redeploy" in Vercel dashboard after each Git push.

---

**Last working auto-deploy:** ~2 hours ago (before we started)  
**Current workaround:** Manual redeploy  
**Needs investigation:** Why Git integration stopped working
