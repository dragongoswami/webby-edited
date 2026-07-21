/**
 * Tests for preview-inspector theme handling.
 * Tests applyThemeVariables and message-based theme switching.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyThemeVariables } from '../preview-inspector';

describe('applyThemeVariables', () => {
    beforeEach(() => {
        // Clean up any leftover theme style elements
        document.getElementById('inspector-theme-overrides')?.remove();
        // Reset inline styles on root
        document.documentElement.removeAttribute('style');
    });

    afterEach(() => {
        document.getElementById('inspector-theme-overrides')?.remove();
        document.documentElement.removeAttribute('style');
    });

    it('sets light mode CSS variables on document root', () => {
        applyThemeVariables({
            'background': '0 0% 100%',
            'foreground': '222.2 84% 4.9%',
            'primary': '200 98% 39%',
        });

        expect(document.documentElement.style.getPropertyValue('--background')).toBe('0 0% 100%');
        expect(document.documentElement.style.getPropertyValue('--foreground')).toBe('222.2 84% 4.9%');
        expect(document.documentElement.style.getPropertyValue('--primary')).toBe('200 98% 39%');
    });

    it('creates a style element with dark mode overrides', () => {
        applyThemeVariables(
            { 'background': '0 0% 100%' },
            { 'background': '222.2 84% 4.9%', 'foreground': '210 40% 98%' }
        );

        const styleEl = document.getElementById('inspector-theme-overrides');
        expect(styleEl).not.toBeNull();
        expect(styleEl?.tagName).toBe('STYLE');
        expect(styleEl?.getAttribute('data-preview-inspector')).toBe('theme');
        expect(styleEl?.textContent).toContain('.dark {');
        expect(styleEl?.textContent).toContain('--background: 222.2 84% 4.9%;');
        expect(styleEl?.textContent).toContain('--foreground: 210 40% 98%;');
    });

    it('updates existing style element on repeat calls (no duplicates)', () => {
        applyThemeVariables(
            { 'primary': '200 98% 39%' },
            { 'primary': '198 93% 59%' }
        );
        applyThemeVariables(
            { 'primary': '266 4% 20.8%' },
            { 'primary': '256 1.3% 92.9%' }
        );

        const styleEls = document.querySelectorAll('#inspector-theme-overrides');
        expect(styleEls.length).toBe(1);
        expect(styleEls[0].textContent).toContain('--primary: 256 1.3% 92.9%;');
        expect(styleEls[0].textContent).not.toContain('198 93% 59%');
    });

    it('handles empty dark map gracefully', () => {
        applyThemeVariables(
            { 'background': '0 0% 100%' },
            {}
        );

        expect(document.documentElement.style.getPropertyValue('--background')).toBe('0 0% 100%');
        // No style element created for empty dark map
        expect(document.getElementById('inspector-theme-overrides')).toBeNull();
    });

    it('handles undefined dark map gracefully', () => {
        applyThemeVariables({ 'background': '0 0% 100%' });

        expect(document.documentElement.style.getPropertyValue('--background')).toBe('0 0% 100%');
        expect(document.getElementById('inspector-theme-overrides')).toBeNull();
    });

    it('handles many variables correctly', () => {
        const light: Record<string, string> = {
            'background': '0 0% 100%',
            'foreground': '222.2 84% 4.9%',
            'primary': '200 98% 39%',
            'primary-foreground': '204 100% 97%',
            'secondary': '215 24% 26%',
            'accent': '210 40% 98%',
            'border': '212 26% 83%',
            'ring': '200 98% 39%',
            'sidebar': '210 40% 98%',
            'sidebar-foreground': '222 47% 11%',
            'radius': '0.5rem',
        };

        const dark: Record<string, string> = {
            'background': '222 47% 11%',
            'foreground': '210 40% 98%',
            'primary': '198 93% 59%',
            'primary-foreground': '204 80% 15%',
            'secondary': '212 26% 83%',
            'accent': '228 84% 4%',
            'border': '0 0% 100% / 10%',
            'ring': '198 93% 59%',
            'sidebar': '222 47% 11%',
            'sidebar-foreground': '210 40% 98%',
        };

        applyThemeVariables(light, dark);

        // Verify light vars
        expect(document.documentElement.style.getPropertyValue('--primary')).toBe('200 98% 39%');
        expect(document.documentElement.style.getPropertyValue('--radius')).toBe('0.5rem');
        expect(document.documentElement.style.getPropertyValue('--sidebar')).toBe('210 40% 98%');

        // Verify dark style tag
        const styleEl = document.getElementById('inspector-theme-overrides');
        expect(styleEl).not.toBeNull();
        expect(styleEl?.textContent).toContain('--primary: 198 93% 59%;');
        expect(styleEl?.textContent).toContain('--sidebar: 222 47% 11%;');
        expect(styleEl?.textContent).toContain('--border: 0 0% 100% / 10%;');
    });
});
