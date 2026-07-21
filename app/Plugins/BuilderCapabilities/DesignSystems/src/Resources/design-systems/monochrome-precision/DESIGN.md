# Monochrome Precision

Black and white precision meets geometric elegance. The Vercel aesthetic.

## 1. Visual Theme & Atmosphere

**Mood:** Technical precision, minimalist confidence. Pure black and white with no unnecessary decoration. The design speaks through restraint and exactness.

**Aesthetic Direction:** Geometric minimalism. Sharp edges, perfect alignment, zero visual noise.

**Density:** Dense when needed, but always controlled. Information hierarchy through size and weight alone.

**Key Visual Elements:**
- Pure black (#000000) and white (#FFFFFF) palette
- Geometric sans-serif (Geist)
- Precise 4px grid alignment
- No shadows, no gradients (except subtle hover states)

## 2. Color Palette & Roles

```css
:root {
  /* Core */
  --color-black: #000000;
  --color-white: #FFFFFF;

  /* Grays - 11 steps */
  --color-gray-50: #FAFAFA;
  --color-gray-100: #F4F4F4;
  --color-gray-200: #E4E4E4;
  --color-gray-300: #D3D3D3;
  --color-gray-400: #A3A3A3;
  --color-gray-500: #737373;
  --color-gray-600: #525252;
  --color-gray-700: #404040;
  --color-gray-800: #262626;
  --color-gray-900: #171717;

  /* Semantic */
  --color-success: #10B981;
  --color-error: #EF4444;
  --color-warning: #F59E0B;
}
```

## 3. Typography Rules

**Font Family:** Geist (fallback: -apple-system, sans-serif)

```css
--font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Geist Mono', 'SF Mono', monospace;

--text-2xs: 0.625rem;  /* 10px */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.5rem;     /* 24px */
--text-2xl: 2rem;      /* 32px */
--text-3xl: 3rem;      /* 48px */
```

**Headings:** Geist, tight letter-spacing (-0.03em), medium weight (500).

**Body:** Geist at 16px/1.5 line-height.

## 4. Component Stylings

### Buttons
```css
.btn {
  padding: 0.625rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--color-black);
  color: var(--color-white);
}
.btn-primary:hover {
  background: var(--color-gray-900);
}
```

### Cards
```css
.card {
  background: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 8px;
  padding: 1.25rem;
}
```

### Input Fields
```css
.input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-gray-200);
  border-radius: 6px;
  font-size: 0.875rem;
}
.input:focus {
  outline: none;
  border-color: var(--color-black);
}
```

## 5. Layout Principles

**Spacing Scale:** 4px base
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
```

**Max Width:** 1280px.

**Grid:** 12-column with 16px gutters.

## 6. Depth & Elevation

No shadows. Depth comes from borders and background color shifts only.

## 7. Do's and Don'ts

**Do:**
- Use pure black as primary action color
- Maintain pixel-perfect alignment
- Let white space do the work
- Use gray scales for hierarchy

**Don't:**
- Add drop shadows
- Use color for decoration
- Round corners excessively (max 8px)
- Mix multiple typefaces

## 8. Responsive Behavior

**Breakpoints:**
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

## 9. Agent Prompt Guide

**Quick Reference:**
- Colors: #000000 (black), #FFFFFF (white), grays only
- Font: Geist (system-ui fallback)
- Border radius: 6px buttons, 8px cards
- No shadows

**Use When Building:**
- Developer tools
- Deployment platforms
- Technical documentation
- Modern SaaS dashboards