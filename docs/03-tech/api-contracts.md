# API Contracts

## REST Endpoints

### GET `/api/pig/:id`
Fetch pig data by UUID.

**Request**
```
GET /api/pig/a7b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response 200**
```json
{
  "id": "a7b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Rosie",
  "scanCount": 3,
  "firstScanAt": "2025-10-15T08:30:00Z",
  "lastScanAt": "2025-10-17T14:20:00Z",
  "rituals": ["breathe", "gratitude"]
}
```

**Response 404**
```json
{
  "error": "Pig not found",
  "message": "This pig hasn't hatched yet"
}
```

---

### POST `/api/pig/:id/name`
Update pig's name.

**Request**
```json
{
  "name": "Rosie"
}
```

**Validation**
- Length: 2-20 characters
- Allowed: Letters, spaces, hyphens
- Sanitize: Trim whitespace

**Response 200**
```json
{
  "success": true,
  "pig": { /* updated pig object */ }
}
```

**Response 400**
```json
{
  "error": "Invalid name",
  "message": "Names must be 2-20 characters"
}
```

---

### POST `/api/pig/:id/ritual`
Log ritual completion.

**Request**
```json
{
  "ritualType": "breathe",
  "completedAt": "2025-10-17T14:25:00Z"
}
```

**Response 200**
```json
{
  "success": true,
  "message": "Ritual logged"
}
```

---

## Data Models
See `docs/03-tech/data-model.md` for schema.
