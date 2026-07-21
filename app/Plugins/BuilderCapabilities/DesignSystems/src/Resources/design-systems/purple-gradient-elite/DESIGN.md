# Purple Gradient Elite

Signature purple gradients with weight-300 elegance. The Stripe aesthetic for fintech.

## 1. Visual Theme & Atmosphere

**Mood:** Sophisticated, trustworthy, premium. Purple gradients that feel both tech-forward and reassuring. Weight-300 typography creates lightness.

**Aesthetic Direction:** Gradient-heavy with clean geometry. Premium without being flashy.

**Density:** Light, airy density with generous white space.

**Key Visual Elements:**
- Purple gradients (#635BFF → #0084FF)
- Very light weight typography (300-400)
- Large rounded corners
- Gradient text effects

## 2. Color Palette & Roles

```css
:root {
  --color-primary: #635BFF;
  --color-primary-light: #858AFE;
  --color-accent: #0084FF;
  --color-bg: #FFFFFF;
  --color-surface: #F6F9FC;
  --color-text: #1A1A1A;
  --color-text-secondary: #6B778C;
  --color-border: #E6E8EB;
  --gradient-primary: linear-gradient(135deg, #635BFF 0%, #0084FF 100%);
}
```

## 3. Typography Rules

**Font Family:** Inter (weight 300-500)

```css
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.25rem;
--text-xl: 1.5rem;
--text-2xl: 2.5rem;
--text-3xl: 3.5rem;
```

**Headings:** Inter weight 300, letter-spacing: -0.02em

**Body:** Inter weight 400, line-height: 1.6

## 4. Component Stylings

### Buttons
```css
.btn {
  padding: 0.875rem 2rem;
  border-radius: 100px;
  font-weight: 500;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 14px rgba(99, 91, 255, 0.3);
}
```

### Cards
```css
.card {
  background: var(--color-surface);
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid var(--color-border);
}
```

## 5. Agent Prompt Guide

**Quick Reference:**
- Primary gradient: #635BFF → #0084FF
- Border radius: 100px (buttons), 16px (cards)
- Font: Inter weight 300-500

**Use When Building:**
- Fintech platforms
- Payment processors
- Professional SaaS
- Enterprise tools