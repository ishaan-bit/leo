# Component Specifications

## Atomic Design Structure
Atoms → Molecules → Organisms

## Atoms

### SpeechBubble
- **Purpose**: Display pig's dialogue
- **Variants**: Default, thinking (with "...")
- **Props**: `text: string`, `isThinking?: boolean`
- **Animation**: Fade in + slight bounce (300ms)

### Button
- **Variants**: Primary, Secondary, Ghost
- **States**: Default, Hover, Active, Disabled
- **Hover**: Scale 1.02, shadow increase
- **Size**: Min 48px height (touch-friendly)

## Molecules

### PinkPig
- **Purpose**: Animated pig character
- **Format**: Lottie JSON
- **States**: Idle, Speaking, Happy, Thinking
- **Size**: 200x200px (responsive)
- **Trigger**: Auto-play on mount

### NameInput
- **Type**: Text input with validation
- **Max length**: 20 characters
- **Validation**: No special chars, min 2 chars
- **Error state**: Soft coral underline + helper text

## Organisms

### PigRitualBlock
- **Composition**: PinkPig + SpeechBubble + CTA
- **Layout**: Vertical stack, centered
- **Spacing**: 32px gaps
- **Animation**: Sequential reveal (pig → bubble → CTA)

## Responsive Breakpoints
```css
--mobile: 0-640px
--tablet: 641-1024px
--desktop: 1025px+
```

## Accessibility
- All interactive elements: min 44x44px
- ARIA labels on custom components
- Keyboard navigation support
- Focus indicators (2px outline, --pink-deep)
