import { describe, it, expect } from 'vitest';
import { Sparkles } from 'lucide-react';
import { getIconComponent, ICON_NAMES, getTranslatedFeatures } from './data';

const id = (s: string) => s;

describe('feature cards', () => {
    it('includes the new plugin-gated and always-on cards', () => {
        const features = getTranslatedFeatures(id);
        const ids = features.map((f) => f.id);
        for (const k of ['wordpress-themes', 'shopify-themes', 'github-sync', 'supabase-db', 'design-systems', 'personal-api', 'voice-input']) {
            expect(ids).toContain(k);
        }
    });

    it('tags plugin cards with their plugin_slug and leaves always-on cards untagged', () => {
        const features = getTranslatedFeatures(id);
        const by = (k: string) => features.find((f) => f.id === k)!;
        expect(by('wordpress-themes').plugin_slug).toBe('wordpress');
        expect(by('shopify-themes').plugin_slug).toBe('shopify');
        expect(by('github-sync').plugin_slug).toBe('github');
        expect(by('voice-input').plugin_slug ?? null).toBeNull();
    });
});

describe('icon map', () => {
    it('resolves the new feature-card icons to non-fallback components', () => {
        for (const name of ['Database', 'Github', 'ShoppingBag', 'Newspaper', 'KeyRound', 'Mic', 'Palette']) {
            expect(getIconComponent(name)).not.toBe(Sparkles);
        }
    });

    it('exports the full list of registered icon names', () => {
        expect(ICON_NAMES).toContain('Database');
        expect(ICON_NAMES).toContain('Sparkles');
    });
});
