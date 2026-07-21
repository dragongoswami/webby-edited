import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ColorsTab } from './ColorsTab';
import { COLOR_FAMILIES, COLOR_SHADES, COLOR_SWATCH, SHADE_HEX } from './tailwind-data';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

/** Build the exact removal sweep the component performs for a given prop/breakpoint. */
function buildRemoveSweep(prop: 'text' | 'bg' | 'border' = 'text', bp = ''): string[] {
    const remove: string[] = [];
    for (const f of COLOR_FAMILIES) {
        for (const s of COLOR_SHADES) {
            remove.push(`${bp}${prop}-${f}-${s}`);
        }
    }
    remove.push(`${bp}${prop}-white`, `${bp}${prop}-black`, `${bp}${prop}-transparent`);
    return remove;
}

describe('ColorsTab', () => {
    const renderTab = (classes: string[] = [], breakpoint = '', onUpdateClasses = vi.fn()) => {
        render(<ColorsTab classes={classes} breakpoint={breakpoint} onUpdateClasses={onUpdateClasses} />);
        return onUpdateClasses;
    };

    it('renders the 3 property-toggle buttons with Text Color active by default', () => {
        renderTab();

        const textBtn = screen.getByText('Text Color');
        const bgBtn = screen.getByText('Background');
        const borderBtn = screen.getByText('Border Color');

        expect(textBtn).toBeInTheDocument();
        expect(bgBtn).toBeInTheDocument();
        expect(borderBtn).toBeInTheDocument();

        expect(textBtn.className).toMatch(/bg-primary/);
        expect(bgBtn.className).not.toMatch(/bg-primary/);
        expect(borderBtn.className).not.toMatch(/bg-primary/);
    });

    it('renders the 3 special color buttons', () => {
        renderTab();

        expect(screen.getByText('white')).toBeInTheDocument();
        expect(screen.getByText('black')).toBeInTheDocument();
        expect(screen.getByText('transparent')).toBeInTheDocument();
    });

    it('renders one family swatch button per COLOR_FAMILIES entry with the correct swatch color', () => {
        renderTab();

        COLOR_FAMILIES.forEach(family => {
            const btn = screen.getByTitle(family);
            expect(btn).toBeInTheDocument();
            expect(btn.style.backgroundColor).toBeTruthy();
        });

        // Spot check a couple of exact swatch colors via inline style (jsdom normalizes hex -> rgb)
        const swatchToRgb = (hex: string) => {
            const div = document.createElement('div');
            div.style.backgroundColor = hex;
            return div.style.backgroundColor;
        };

        const blueBtn = screen.getByTitle('blue') as HTMLElement;
        expect(blueBtn.style.backgroundColor).toBe(swatchToRgb(COLOR_SWATCH.blue));

        const redBtn = screen.getByTitle('red') as HTMLElement;
        expect(redBtn.style.backgroundColor).toBe(swatchToRgb(COLOR_SWATCH.red));
    });

    it('applySpecial: clicking white (default text prop) calls onUpdateClasses with the exact add/remove sweep', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByText('white'));

        const expectedRemove = buildRemoveSweep('text', '');
        expect(expectedRemove).toHaveLength(COLOR_FAMILIES.length * COLOR_SHADES.length + 3);

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(['text-white'], expectedRemove);
    });

    it('property toggle changes the prefix used by applySpecial (Background -> black)', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByText('Background'));
        fireEvent.click(screen.getByText('black'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['bg-black'], buildRemoveSweep('bg', ''));
    });

    it('breakpoint prefixing: bp=md, clicking transparent sweeps md:-prefixed classes', () => {
        const onUpdateClasses = renderTab([], 'md');

        fireEvent.click(screen.getByText('transparent'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['md:text-transparent'], buildRemoveSweep('text', 'md:'));
    });

    it('family expansion: clicking a family swatch reveals its shade row, label, and scale hints; collapses on second click', () => {
        renderTab();

        expect(screen.queryByTitle('blue-500')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTitle('blue'));

        // Shade buttons for all COLOR_SHADES now exist
        COLOR_SHADES.forEach(shade => {
            expect(screen.getByTitle(`blue-${shade}`)).toBeInTheDocument();
        });

        // Capitalized family label
        expect(screen.getByText('blue')).toBeInTheDocument();

        // Scale hints
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('500')).toBeInTheDocument();
        expect(screen.getByText('950')).toBeInTheDocument();

        // Spot-check shade hex (jsdom normalizes hex -> rgb)
        const swatchToRgb = (hex: string) => {
            const div = document.createElement('div');
            div.style.backgroundColor = hex;
            return div.style.backgroundColor;
        };
        const shade600 = screen.getByTitle('blue-600') as HTMLElement;
        expect(shade600.style.backgroundColor).toBe(swatchToRgb(SHADE_HEX.blue['600']));

        // Collapse
        fireEvent.click(screen.getByTitle('blue'));
        expect(screen.queryByTitle('blue-500')).not.toBeInTheDocument();
    });

    it('apply(family, shade): clicking a shade swatch calls onUpdateClasses with the exact add/remove sweep', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByTitle('blue'));
        fireEvent.click(screen.getByTitle('blue-600'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(['text-blue-600'], buildRemoveSweep('text', ''));
    });

    it('current-color label reflects the active class, or "Select color" when none', () => {
        renderTab(['text-blue-600']);
        expect(screen.getByText('Current: text-blue-600')).toBeInTheDocument();

        renderTab([]);
        expect(screen.getByText('Select color')).toBeInTheDocument();
    });

    it('false-positive guard: border-2/border-solid do not activate a current color under Border Color', () => {
        renderTab(['border-2', 'border-solid']);

        fireEvent.click(screen.getByText('Border Color'));

        expect(screen.getByText('Select color')).toBeInTheDocument();
        expect(screen.queryByText(/^Current:/)).not.toBeInTheDocument();
    });

    it('false-positive guard: text-center does not activate a current color under the default Text Color prop', () => {
        renderTab(['text-center']);

        expect(screen.getByText('Select color')).toBeInTheDocument();
        expect(screen.queryByText(/^Current:/)).not.toBeInTheDocument();
    });

    it('active states: the matching special button and shade button get ring-2, siblings do not', () => {
        renderTab(['text-white']);

        expect(screen.getByText('white').className).toMatch(/ring-2/);
        expect(screen.getByText('black').className).not.toMatch(/ring-2/);
        expect(screen.getByText('transparent').className).not.toMatch(/ring-2/);
    });

    it('active states: expanding the family matching the current class rings only its own shade', () => {
        renderTab(['text-blue-600']);

        fireEvent.click(screen.getByTitle('blue'));

        const activeShade = screen.getByTitle('blue-600') as HTMLElement;
        const otherShade = screen.getByTitle('blue-500') as HTMLElement;

        expect(activeShade.className).toMatch(/ring-2/);
        expect(otherShade.className).not.toMatch(/ring-2/);
    });

    it('breakpoint-scoped current color: not active at base, active once the breakpoint matches', () => {
        const { rerender } = render(
            <ColorsTab classes={['md:text-blue-600']} breakpoint="" onUpdateClasses={vi.fn()} />,
        );

        expect(screen.getByText('Select color')).toBeInTheDocument();

        rerender(<ColorsTab classes={['md:text-blue-600']} breakpoint="md" onUpdateClasses={vi.fn()} />);

        expect(screen.getByText('Current: text-blue-600')).toBeInTheDocument();
    });
});
