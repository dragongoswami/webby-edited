import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EffectsTab } from './EffectsTab';
import { SHADOW_OPTIONS } from './tailwind-data';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

/** Locate the section wrapper (label + control row) by its label text. */
function getSection(labelText: string): HTMLElement {
    const label = screen.getByText(labelText);
    return label.parentElement as HTMLElement;
}

/** Build the exact removal sweep applyShadow performs for a given breakpoint prefix. */
function buildShadowRemoveSweep(bp = ''): string[] {
    return SHADOW_OPTIONS.map(s => (s.value === '' ? `${bp}shadow` : `${bp}shadow-${s.value}`));
}

describe('EffectsTab', () => {
    const renderTab = (classes: string[] = [], breakpoint = '', onUpdateClasses = vi.fn()) => {
        render(<EffectsTab classes={classes} breakpoint={breakpoint} onUpdateClasses={onUpdateClasses} />);
        return onUpdateClasses;
    };

    it('renders the Shadow and Opacity sections', () => {
        renderTab();

        expect(screen.getByText('Shadow')).toBeInTheDocument();
        expect(screen.getByText(/^Opacity/)).toBeInTheDocument();
    });

    it('renders one button per SHADOW_OPTIONS entry', () => {
        renderTab();

        const section = getSection('Shadow');
        SHADOW_OPTIONS.forEach(s => {
            expect(within(section).getByText(s.label)).toBeInTheDocument();
        });
    });

    it('applyShadow special case: clicking Base (value "") adds bare "shadow", not "shadow-"', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Shadow');
        fireEvent.click(within(section).getByText('Base'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(['shadow'], buildShadowRemoveSweep());
    });

    it('applyShadow remove sweep maps the Base entry ("") to bare "shadow" among shadow-{value} entries', () => {
        renderTab();

        const remove = buildShadowRemoveSweep();
        expect(remove).toEqual([
            'shadow-none',
            'shadow-sm',
            'shadow',
            'shadow-md',
            'shadow-lg',
            'shadow-xl',
            'shadow-2xl',
            'shadow-inner',
        ]);
    });

    it('applyShadow: clicking a non-base value adds the shadow-{value} class', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Shadow');
        fireEvent.click(within(section).getByText('LG'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['shadow-lg'], buildShadowRemoveSweep());
    });

    it('breakpoint prefixing: bp=lg, clicking a shadow value prefixes both the add and the whole remove sweep', () => {
        const onUpdateClasses = renderTab([], 'lg');

        const section = getSection('Shadow');
        fireEvent.click(within(section).getByText('SM'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['lg:shadow-sm'], buildShadowRemoveSweep('lg:'));
    });

    it('active shadow highlight: bare "shadow" class activates the Base button', () => {
        renderTab(['shadow']);

        const section = getSection('Shadow');
        expect(within(section).getByText('Base').className).toMatch(/bg-primary/);
        expect(within(section).getByText('LG').className).not.toMatch(/bg-primary/);
    });

    it('active shadow highlight: "shadow-lg" activates the LG button, not Base', () => {
        renderTab(['shadow-lg']);

        const section = getSection('Shadow');
        expect(within(section).getByText('LG').className).toMatch(/bg-primary/);
        expect(within(section).getByText('Base').className).not.toMatch(/bg-primary/);
    });

    it('no shadow class active: no shadow button is highlighted', () => {
        renderTab([]);

        const section = getSection('Shadow');
        SHADOW_OPTIONS.forEach(s => {
            expect(within(section).getByText(s.label).className).not.toMatch(/bg-primary/);
        });
    });

    it('opacity label defaults to 100% with no opacity class present', () => {
        renderTab();

        expect(screen.getByText('Opacity: 100%')).toBeInTheDocument();
    });

    it('opacity label reflects the active opacity-{n} class', () => {
        renderTab(['opacity-40']);

        expect(screen.getByText('Opacity: 40%')).toBeInTheDocument();
    });

    it('opacity label is breakpoint-scoped: an md-prefixed class is ignored at base, honored at md', () => {
        const { rerender } = render(
            <EffectsTab classes={['md:opacity-40']} breakpoint="" onUpdateClasses={vi.fn()} />,
        );
        expect(screen.getByText('Opacity: 100%')).toBeInTheDocument();

        rerender(<EffectsTab classes={['md:opacity-40']} breakpoint="md" onUpdateClasses={vi.fn()} />);
        expect(screen.getByText('Opacity: 40%')).toBeInTheDocument();
    });

    // The Radix slider's pointer-drag interaction can't be reliably simulated in jsdom (no
    // pointer capture / layout), but its Thumb supports native keyboard arrow-key adjustment,
    // which exercises the same onValueChange -> applyOpacity(Math.round(v / 5) * 5) path.
    it('applyOpacity via keyboard: ArrowLeft from the default (100) decrements by the 5-step and sweeps all 21 opacity-N classes', () => {
        const onUpdateClasses = renderTab();

        const thumb = screen.getByRole('slider');
        thumb.focus();
        fireEvent.keyDown(thumb, { key: 'ArrowLeft' });

        const expectedRemove = Array.from({ length: 21 }, (_, i) => `opacity-${i * 5}`);
        expect(expectedRemove).toHaveLength(21);
        expect(expectedRemove[0]).toBe('opacity-0');
        expect(expectedRemove[20]).toBe('opacity-100');

        expect(onUpdateClasses).toHaveBeenCalledWith(['opacity-95'], expectedRemove);
    });

    it('applyOpacity via keyboard: Home jumps to the slider minimum (0)', () => {
        const onUpdateClasses = renderTab();

        const thumb = screen.getByRole('slider');
        thumb.focus();
        fireEvent.keyDown(thumb, { key: 'Home' });

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['opacity-0'],
            Array.from({ length: 21 }, (_, i) => `opacity-${i * 5}`),
        );
    });
});
