# Data Model

## Database Schema (PostgreSQL)

### Table: `pigs`
```sql
CREATE TABLE pigs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(20),
  scan_count INTEGER DEFAULT 1,
  first_scan_at TIMESTAMP DEFAULT NOW(),
  last_scan_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `rituals`
```sql
CREATE TABLE rituals (
  id SERIAL PRIMARY KEY,
  pig_id UUID REFERENCES pigs(id) ON DELETE CASCADE,
  ritual_type VARCHAR(50) NOT NULL,
  completed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rituals_pig_id ON rituals(pig_id);
```

### Table: `scans` (optional analytics)
```sql
CREATE TABLE scans (
  id SERIAL PRIMARY KEY,
  pig_id UUID REFERENCES pigs(id) ON DELETE CASCADE,
  scanned_at TIMESTAMP DEFAULT NOW(),
  user_agent TEXT,
  ip_hash VARCHAR(64)  -- hashed for privacy
);

CREATE INDEX idx_scans_pig_id ON scans(pig_id);
CREATE INDEX idx_scans_date ON scans(scanned_at);
```

## Local Storage (Client-Side)
```typescript
interface LocalPigData {
  pigId: string;
  name?: string;
  lastVisit: string;  // ISO timestamp
  scanCount: number;
}

// Key: `pig_${pigId}`
```

## Data Privacy
- No PII collected (names are pseudonyms)
- IP addresses hashed (SHA-256)
- Data retention: 90 days inactive → anonymize
- GDPR-compliant (right to deletion)
