# Technical Architecture

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Modules
- **Animation**: Lottie, Framer Motion
- **State**: React hooks (local state), Zustand (global if needed)

### Backend
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: NextAuth.js (optional, future)
- **Storage**: Supabase Storage (Lottie files, images)

### Infrastructure
- **Hosting**: Vercel
- **CDN**: Vercel Edge Network
- **Analytics**: Plausible / Vercel Analytics
- **Monitoring**: Sentry (errors)

## Architecture Patterns

### Directory Structure
```
apps/web/
  ├── app/              # Next.js App Router
  │   ├── p/[pigId]/   # Dynamic pig pages
  │   └── layout.tsx
  ├── src/
  │   ├── components/  # Atomic design
  │   ├── domain/      # Business logic (pig, auth)
  │   ├── lib/         # Utilities (http, storage, etc.)
  │   ├── styles/      # Global CSS, tokens
  │   └── config/      # Env, routes
```

### Data Flow
```
[QR Scan] 
  → [GET /api/pig/:id] 
  → [Supabase query] 
  → [Return pig data] 
  → [Client renders PigRitualBlock]
  → [User names pig]
  → [POST /api/pig/:id/name]
  → [Update DB + localStorage]
```

## Design Decisions

### Why Next.js?
- SSR for fast initial load
- API routes for backend logic
- Built-in optimization (images, fonts)
- Vercel deployment integration

### Why Supabase?
- PostgreSQL (relational, reliable)
- Real-time subscriptions (future)
- Built-in auth (future)
- Storage for media files

### Why Monorepo?
- Shared types between packages
- Future: Native app, Chrome extension
- Easier dependency management
