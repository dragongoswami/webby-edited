# Warm Canvas Studio

Warm minimalism with earth tones and premium typography. The Notion-meets-editorial aesthetic.

## 1. Visual Theme & Atmosphere

**Mood:** Calm, focused, warm. Natural tones that feel approachable yet professional. Serif headings add editorial sophistication.

**Aesthetic Direction:** Warm minimalism with serif headlines. Like a premium reading app or thoughtful workspace tool.

**Density:** Light with generous margins. Content breathes.

**Key Visual Elements:**
- Warm cream backgrounds (#FFFDF8)
- Warm gray text (#1C1C1C)
- Serif headings (Fraunces)
- Rounded corners, subtle shadows

## 2. Color Palette & Roles

```css
:root {
  --color-primary: #E85D3B;
  --color-primary-hover: #D14D2C;
  --color-bg: #FFFDF8;
  --color-surface: #FFFFFF;
  --color-border: #E8E4DC;
  --color-text: #1C1C1C;
  --color-text-secondary: #6B6560;
}
```

## 3. Typography Rules

**Font Family:** Inter (body), Fraunces (headings)

```css
--font-body: 'Inter', -apple-system, sans-serif;
--font-display: 'Fraunces', Georgia, serif;
```

**Headings:** Fraunces, weight 600, tight letter-spacing.

**Body:** Inter weight 400, line-height: 1.7

## 4. Component Stylings

### Buttons
```css
.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
}
.btn-primary {
  background: var(--color-primary);
  color: white;
}
```

### Cards
```css
.card {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

## 5. Agent Prompt Guide

**Quick Reference:**
- Background: #FFFDF8 (warm cream)
- Primary: #E85D3B (warm red-orange)
- Font: Inter (body), Fraunces (headings)

**Use When Building:**
- Note-taking apps
- Publishing platforms
- Creative portfolios
- Workspace tools