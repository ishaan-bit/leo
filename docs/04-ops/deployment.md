# Deployment Guide

## Vercel Deployment

### Setup
1. Connect GitHub repo to Vercel
2. Set root directory: `apps/web`
3. Build command: `npm run build`
4. Output directory: `.next`

### Environment Variables
Add in Vercel dashboard:
```
DATABASE_URL=<supabase-connection-string>
NEXT_PUBLIC_API_URL=https://leo.app
NEXTAUTH_SECRET=<random-32-char-string>
```

### Regions
- Primary: Singapore (SIN1) → closest to India
- Fallback: Global edge network

## CI/CD Pipeline

### Branches
- `main` → Production (auto-deploy)
- `staging` → Preview (auto-deploy)
- `dev/*` → PR previews

### Checks (GitHub Actions)
```yaml
- Lint (ESLint)
- Type check (TypeScript)
- Build test
- Unit tests (if any)
```

## Database Migrations

### Process
1. Write migration SQL in `scripts/migrations/`
2. Test locally: `npm run migrate:dev`
3. Deploy: `npm run migrate:prod` (manual for now)
4. Supabase UI → Run migration

### Example Migration
```sql
-- migrations/001_create_pigs.sql
CREATE TABLE IF NOT EXISTS pigs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(20),
  scan_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Monitoring

### Metrics
- Vercel Analytics: Page views, Web Vitals
- Sentry: Error tracking
- Supabase Dashboard: Query performance

### Alerts
- Error rate > 1% → Slack notification
- Latency > 2s → Investigate
- Database CPU > 80% → Scale up

## Rollback
- Vercel: Instant rollback to previous deployment
- Database: Keep migration backups (manual restore)
