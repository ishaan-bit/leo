# Security & Privacy

## Security Measures

### API Security
- Rate limiting: 100 req/min per IP
- CORS: Restrict to app domain
- Input validation: Sanitize all user input
- SQL injection: Use parameterized queries (Supabase handles)

### Data Protection
- HTTPS only (enforced by Vercel)
- Environment variables for secrets
- No sensitive data in client code
- Supabase RLS (Row Level Security) policies

### QR Code Security
- UUIDs are non-sequential (prevent enumeration)
- No sensitive data in QR (just pigId)
- Expiry logic (optional: QR valid for X days)

## Privacy Policy

### Data Collected
1. Pig name (user-provided pseudonym)
2. Scan timestamps
3. IP address hash (for abuse prevention)
4. User agent (for analytics)

### Data NOT Collected
- Real names or emails (unless explicit signup)
- Location data (no GPS)
- Device identifiers (no fingerprinting)

### User Rights
- View data: GET `/api/pig/:id`
- Delete data: POST `/api/pig/:id/delete` (future)
- Export data: JSON download (future)

### Compliance
- **GDPR**: Right to access, deletion, portability
- **COPPA**: No data from users <13 (pig toys → likely kids)
- **India DPDP Act 2023**: Consent-based, minimal collection

## Cookie Policy
- Session cookies only (Next.js default)
- No third-party trackers
- Analytics: First-party only (Plausible)
