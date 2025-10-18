# Copilot Instructions

## Project Overview
**Noen** — A minimal landing page for a mindfulness/wellbeing startup. Design aesthetic: liminal, calm but alive, modern, minimal, and poetic. Features a **dusk-inspired color palette** with muted purples and warm neutrals.

## Architecture & Components
- **Single-page static site**: No framework, vanilla HTML/CSS/JS for simplicity
- **Tailwind CSS via CDN**: Custom dusk color palette (dusk-cream, dusk-lavender, dusk-mauve, dusk-plum, dusk-wine, dusk-terracotta, dusk-blush, dusk-fog)
- **Sections**: Hero (animated gradient + floating orbs) → Ethos → Features (3-col with hover) → Artisan Story → Founder → Email Signup → Footer
- **Animations**: Intersection Observer for scroll-triggered fade-ins, parallax effects, gradient motion, smooth scrolling
- **Interactivity**: Mouse-responsive hero orbs, button hover effects, image parallax

## Development Workflows

### Local Development
```powershell
# Option 1: Use VS Code Live Server extension (recommended)
# Right-click index.html → "Open with Live Server"

# Option 2: Python HTTP server
python -m http.server 8000

# Option 3: Node.js server
npx http-server
```

Open `http://localhost:5500` (Live Server) or `http://localhost:8000`

## Code Conventions & Patterns

### Design System
- **Typography**: `font-display` (Cormorant Garamond serif) for headings, `font-sans` (Inter) for body
- **Spacing**: Generous padding (`py-32` for sections), breathing room between elements
- **Colors**: Use semantic dusk names from `tailwind.config` — `bg-dusk-cream`, `text-dusk-plum`, `text-dusk-wine`, `bg-gradient-to-br from-dusk-lavender to-dusk-mauve`
- **Gradients**: Multi-color gradients for depth (`bg-gradient-to-br from-dusk-cream via-dusk-blush to-dusk-lavender/30`)
- **Responsive**: Mobile-first with `md:` breakpoints, stack features on mobile
- **Animations**: Custom Tailwind keyframes (`animate-gradient`, `animate-float`, `animate-fade-in-up`)

### Animation Pattern
```javascript
// Scroll-triggered animations use Intersection Observer with staggered delays
document.querySelectorAll('.fade-in-scroll').forEach((el, index) => {
    el.dataset.delay = index * 100;
    observer.observe(el);
});

// Parallax uses requestAnimationFrame for smooth 60fps scrolling
function updateParallax() {
    const scrolled = window.scrollY;
    heroContent.style.transform = `translateY(${scrolled * 0.5}px)`;
}
window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
```
Apply `.fade-in-scroll` class to elements that should animate on scroll into view. Use `.parallax-image` for elements with scroll parallax.

### Component Structure
- **Sections** are semantic `<section>` tags with consistent padding (`py-32 px-6`)
- **Max-width containers**: `max-w-4xl`, `max-w-7xl` for content centering
- **Placeholder images**: Use `aspect-square` or `aspect-[4/5]` divs with gradient backgrounds (`bg-gradient-to-br from-dusk-lavender/30 to-dusk-mauve/20`)
- **Hero section**: Uses absolute positioned floating orbs with `blur-3xl` and `animate-float`
- **Gradient backgrounds**: Layer multiple gradients for depth using `bg-gradient-to-br` with opacity modifiers

### JavaScript Patterns
- Vanilla JS, no dependencies beyond Tailwind CDN
- Use `requestAnimationFrame` for smooth 60fps animations
- Event listeners with `{ passive: true }` for scroll performance
- Async/await for future API calls (email signup placeholder)
- Mouse movement tracked for subtle hero interactivity
- Staggered delays on scroll reveals (`transitionDelay`)
- Console Easter eggs for personality (`console.log` greeting with dusk colors)

## Key Dependencies & Integration Points
- **Tailwind CSS** (v3): Loaded via CDN, configured inline in `<head>`
- **Google Fonts**: Cormorant Garamond + Inter
- **Email Service** (TODO): Replace `app.js` form handler with Mailchimp/ConvertKit/Supabase API

## Important Files & Directories
- `index.html` — Main page structure, includes Tailwind config
- `style.css` — Custom animations, fade-in transitions, responsive tweaks
- `app.js` — Scroll animations, form validation, smooth scroll, navbar effects
- `README.md` — Setup instructions, color palette, customization guide

## Future Enhancements
When adding features, maintain the liminal dusk aesthetic:
- Use fade/blur transitions with easing curves (`cubic-bezier(0.4, 0, 0.2, 1)`)
- Keep copy poetic and minimal (avoid marketing jargon)
- Add images with soft, twilight tones (purple/pink/warm neutral palette)
- Consider micro-interactions (staggered reveals, mouse parallax, gradient motion)
- Use `hover:scale-105` and `transition-all duration-300` for smooth hover states
- Layer gradients with opacity for depth (e.g., `from-dusk-wine to-dusk-plum`)