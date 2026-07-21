# Terracotta Editor

Warm terracotta accent meets clean editorial layout for a thoughtful writing experience.

## 1. Visual Theme & Atmosphere

**Mood:** Warm, inviting, editor-focused with a touch of sophistication. The terracotta accent brings life to an otherwise restrained palette, creating a space that's both professional and approachable. Perfect for AI conversations where clarity matters.

**Aesthetic Direction:** Editorial minimalism with warm earth tones. Think of a well-curated reading room with natural light streaming through.

**Density:** Light, generous whitespace. Content breathes with comfortable margins.

**Key Visual Elements:**
- Warm terracotta (#C75D3A) as primary accent
- Cream white backgrounds with subtle warm tint
- Clean sans-serif typography with editorial hierarchy
- Card-based layouts with soft shadows

## 2. Color Palette & Roles

```css
:root {
  /* Primary - Warm Terracotta */
  --color-primary: #C75D3A;
  --color-primary-hover: #B54D2C;
  --color-primary-light: rgba(199, 93, 58, 0.1);

  /* Neutrals - Warm Grays */
  --color-bg: #FAFAF8;
  --color-surface: #FFFFFF;
  --color-border: #E8E6E3;
  --color-text: #1A1A1A;
  --color-text-secondary: #6B6B6B;
  --color-text-muted: #9B9B9B;

  /* Semantic */
  --color-success: #3D8C5C;
  --color-warning: #C9A227;
  --color-error: #C75D3A;

  /* Dark Mode */
  --color-dark-bg: #1A1A1A;
  --color-dark-surface: #252525;
  --color-dark-border: #333333;
}
```

## 3. Typography Rules

**Font Family:** Inter (body), Fraunces (display)

```css
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-display: 'Fraunces', Georgia, serif;

--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.5rem;     /* 24px */
--text-2xl: 2rem;      /* 32px */
--text-3xl: 3rem;      /* 48px */
```

**Headings:** Fraunces for display sizes, Inter for smaller. Use letter-spacing: -0.02em for large display text.

**Body:** Inter at 16px/1.6 line-height. Comfortable reading.

## 4. Component Stylings

### Buttons
```css
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}
.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(199, 93, 58, 0.3);
}
```

### Cards
```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

### Input Fields
```css
.input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
```

## 5. Layout Principles

**Spacing Scale:** 4px base (0.25rem)
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;  /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;   /* 48px */
```

**Max Width:** 1200px for content, 720px for reading content.

**Grid:** 12-column with 24px gutters.

## 6. Depth & Elevation

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 12px rgba(0,0,0,0.08);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
```

## 7. Do's and Don'ts

**Do:**
- Use warm neutrals as the canvas
- Apply terracotta sparingly for emphasis
- Maintain generous whitespace
- Use cards to group related content

**Don't:**
- Overuse terracotta - it loses impact
- Use cool grays that clash with warmth
- Cram content without breathing room
- Mix serif and sans-serif arbitrarily

## 8. Responsive Behavior

**Breakpoints:**
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

**Mobile:** Stack layouts, full-width inputs, larger touch targets (min 44px).

## 9. Agent Prompt Guide

**Quick Reference:**
- Primary accent: #C75D3A (Terracotta)
- Background: #FAFAF8 (Warm white)
- Font: Inter (body), Fraunces (display)
- Max width: 1200px
- Border radius: 8px (buttons), 12px (cards)

**Use When Building:**
- AI assistant interfaces
- Documentation sites
- Editorial content platforms
- Clean SaaS dashboards with warmth