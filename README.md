# Leo - Pink Pig QR Experience

> A liminal digital experience that transforms mundane QR scanning into a moment of unexpected joy and connection.

## 🌸 Project Vision

Leo creates meaningful micro-rituals through playful interaction with pink pig toys. When users scan a QR code on their physical pig, they're transported to a gentle, poetic digital space where they can name their pig, engage in mindful practices, and build a lasting connection.

**Target Audience**: Urban India, 25-35, seeking mindfulness moments in digital life.

## � Production Deployment

- **Frontend**: https://leo-indol-theta.vercel.app
- **Backend**: https://strong-happiness-production.up.railway.app
- **AI Analysis**: OpenAI GPT-3.5-turbo (phi-3 locally via Ollama)
- **Database**: Upstash Redis

## �📁 Project Structure

```
Leo/
├── docs/                    # Design documentation
│   ├── 00-intent/          # Vision, experience goals
│   ├── 01-ux/              # Flows, content, research
│   ├── 02-design/          # Visual system, components
│   ├── 03-tech/            # Architecture, API contracts
│   └── 04-ops/             # Security, deployment
│
├── apps/
│   └── web/                # Next.js 14+ app
│       ├── app/            # App router (pages)
│       ├── src/
│       │   ├── components/ # Atomic design (atoms/molecules/organisms)
│       │   ├── domain/     # Business logic (pig, auth)
│       │   ├── lib/        # Utilities (http, storage, sound)
│       │   ├── styles/     # Global CSS, design tokens
│       │   └── config/     # Environment, routes
│       └── tests/          # E2E and unit tests
│
├── packages/               # Shared code (future monorepo)
│   ├── ui/                 # Shared React components
│   ├── utils/              # Shared utilities
│   └── config/             # Shared config (ESLint, TS)
│
└── scripts/                # Dev tooling
    ├── dev-check.sh        # Environment health check
    ├── seed-dev.ts         # Database seeding
    └── migrate.sh          # Migration runner
```

## 🎨 Design System

### Core Principles
- **Liminal**: Calm but alive, spaces between states
- **Minimal**: Generous whitespace, focused interactions
- **Poetic**: Thoughtful copy, gentle tone

### Color Palette
```css
--pink-soft: #FFB8C6;      /* Pig primary */
--pink-deep: #FF8FA3;      /* Hover states */
--beige: #F5F1E8;          /* Background */
--cream: #FDFBF7;          /* Cards */
--gray-900: #2D2A26;       /* Text */
```

### Typography
- **Display**: Cormorant Garamond (headings)
- **Body**: Inter (UI text)

See `docs/02-design/` for full specifications.

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animation**: Lottie, Framer Motion
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Hosting**: Vercel (Singapore region for India proximity)
- **Analytics**: Plausible (privacy-first)

## 🚀 Getting Started

### Prerequisites
```bash
node >= 18.x
npm >= 9.x
```

### Setup
```bash
# Clone and install
git clone <repo-url>
cd Leo
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
cd apps/web
npm run dev
```

Visit `http://localhost:3000`

### Check Environment
```bash
./scripts/dev-check.sh
```

## 📖 Key Documentation

### For Designers
- [Experience Intent](docs/00-intent/experience-intent.md)
- [Liminal Design System](docs/02-design/liminal-design.md)
- [Component Specs](docs/02-design/component-specs.md)

### For Developers
- [Architecture](docs/03-tech/architecture.md)
- [API Contracts](docs/03-tech/api-contracts.md)
- [Data Model](docs/03-tech/data-model.md)

### For Product/UX
- [QR Scan Flow](docs/01-ux/flows/qr-scan-to-name.md)
- [Poetic Hooks](docs/01-ux/content/poetic-hooks.md)
- [Audience Persona](docs/01-ux/research/audience-persona-india-25-35.md)

## 🔐 Security & Privacy

- No PII collected (names are pseudonyms)
- IP addresses hashed (SHA-256)
- Local-first data storage
- GDPR & India DPDP Act compliant

See [Security & Privacy](docs/04-ops/security-privacy.md)

## 🎯 Roadmap

### Phase 1: MVP (Current)
- [x] Project structure setup
- [x] Documentation foundation
- [ ] Basic pig interaction page
- [ ] QR code generation
- [ ] Supabase database setup

### Phase 2: Polish
- [ ] Lottie pig animations
- [ ] Sound effects
- [ ] Analytics integration
- [ ] Performance optimization

### Phase 3: Growth
- [ ] Multi-language support (Hindi)
- [ ] Social sharing
- [ ] Ritual library expansion
- [ ] Native app (React Native)

## 🤝 Contributing

This is a private project. Contributions by invitation only.

## 📄 License

All rights reserved © 2025

---

**Built with intention** 🌸  
*For moments of presence in a distracted world*
