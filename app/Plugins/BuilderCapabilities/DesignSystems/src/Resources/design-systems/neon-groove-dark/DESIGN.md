# Neon Groove Dark

Vibrant green on dark, bold type, album-art-driven. The Spotify aesthetic for streaming experiences.

## 1. Visual Theme & Atmosphere

**Mood:** Energetic, modern, music-forward. The vibrant green accent cuts through dark surfaces creating visual excitement. Bold typography commands attention.

**Aesthetic Direction:** Dark-first with neon accents. Like a premium music streaming app or nightclub website.

**Density:** Medium density with generous padding. Content-focused but not sparse.

**Key Visual Elements:**
- Near-black backgrounds with green (#1DB954) accent
- Bold, uppercase headings
- Rounded corners on interactive elements
- Album-art-driven imagery

## 2. Color Palette & Roles

```css
:root {
  --color-primary: #1DB954;
  --color-primary-hover: #1ED760;
  --color-bg: #121212;
  --color-surface: #181818;
  --color-surface-hover: #282828;
  --color-border: #282828;
  --color-text: #FFFFFF;
  --color-text-secondary: #B3B3B3;
  --color-text-muted: #6A6A6A;
}
```

## 3. Typography Rules

**Font Family:** Inter (body),任何 (display for special moments)

```css
--text-xs: 0.6875rem;  /* 11px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.5rem;     /* 24px */
--text-2xl: 2rem;      /* 32px */
--text-3xl: 3rem;      /* 48px */
```

**Headings:** Uppercase with letter-spacing: 0.08em for impact.

**Body:** Inter at 16px/1.5 line-height.

## 4. Component Stylings

### Buttons
```css
.btn {
  padding: 0.875rem 2rem;
  border-radius: 9999px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--color-primary);
  color: black;
}
.btn-primary:hover {
  background: var(--color-primary-hover);
  transform: scale(1.02);
}
```

### Cards
```css
.card {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 1rem;
  transition: background 0.2s ease;
}
.card:hover {
  background: var(--color-surface-hover);
}
```

## 5. Do's and Don'ts

**Do:**
- Use pill-shaped buttons for primary actions
- Keep text uppercase for headings
- Use green as the accent only, not dominant
- Include album/feature imagery

**Don't:**
- Use green for backgrounds
- Mix serif fonts
- Create sharp corners on buttons

## 6. Responsive Behavior

Breakpoints:
- Mobile-first design
- Cards stack on mobile, grid on desktop

## 7. Agent Prompt Guide

**Quick Reference:**
- Primary: #1DB954 (Spotify Green)
- Background: #121212 (near black)
- Border radius: 8px (cards), 9999px (buttons)
- Font: Inter

**Use When Building:**
- Music/audio platforms
- Entertainment sites
- Dark-themed SaaS with energy
- Community platforms