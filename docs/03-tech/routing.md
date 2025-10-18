# Routing Strategy

## Routes

### Public Routes
```
/                    → Landing page (marketing)
/p/[pigId]           → Dynamic pig interaction page
/about               → About the project (optional)
```

### API Routes
```
GET  /api/pig/:id              → Fetch pig data
POST /api/pig/:id/name         → Update pig name
POST /api/pig/:id/ritual       → Log ritual completion
GET  /api/pig/:id/history      → Get scan history
```

## Dynamic Route: `/p/[pigId]`

### URL Structure
- Format: `/p/{uuid-v4}` (e.g., `/p/a7b2c3d4-e5f6-7890-abcd-ef1234567890`)
- Source: QR code embedded UUID

### SSR vs CSR
- **SSR**: Initial pig data (name, scan count)
- **CSR**: Interactions (naming, ritual completion)

### Error States
- **404**: Invalid pigId → "This pig hasn't hatched yet"
- **500**: Server error → "The pig is sleeping, try again"

## Deep Linking
- QR code → `https://leo.app/p/{pigId}`
- Opens in mobile browser (no app required)
- Future: Custom scheme `leo://pig/{pigId}`

## SEO Considerations
- Each pig page: Unique meta title/description
- OG image: Generated pig preview
- Noindex: True (private experiences)
