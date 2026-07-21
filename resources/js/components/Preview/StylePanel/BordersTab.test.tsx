import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BordersTab } from './BordersTab';
import {
    BORDER_WIDTHS,
    BORDER_STYLES,
    BORDER_RADIUS,
    BORDER_RADIUS_LABELS,
    COLOR_FAMILIES,
    COLOR_SHADES,
} from './tailwind-data';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

/** Locate the section wrapper (label + control row) by its label text. */
function getSection(labelText: string): HTMLElement {
    const label = screen.getByText(labelText);
    return label.parentElement as HTMLElement;
}

/** applyBorderWidth's exact removal sweep (bare "border" + non-1 widths). */
function buildWidthRemoveSweep(bp = ''): string[] {
    return [`${bp}border`, ...BORDER_WIDTHS.filter(w => w !== '1').map(w => `${bp}border-${w}`)];
}

/** apply('border-', ...)'s exact removal sweep over BORDER_STYLES. */
function buildStyleRemoveSweep(bp = ''): string[] {
    return BORDER_STYLES.map(s => `${bp}border-${s}`);
}

/** apply('rounded-', ...)'s exact removal sweep over BORDER_RADIUS (base value "" -> bare "rounded"). */
function buildRadiusRemoveSweep(bp = ''): string[] {
    return BORDER_RADIUS.map(r => (r === '' ? `${bp}rounded` : `${bp}rounded-${r}`));
}

/** applyBorderColor's exact removal sweep (every family x shade). */
function buildColorRemoveSweep(bp = ''): string[] {
    const remove: string[] = [];
    for (const f of COLOR_FAMILIES) {
        for (const s of COLOR_SHADES) {
            remove.push(`${bp}border-${f}-${s}`);
        }
    }
    return remove;
}

describe('BordersTab', () => {
    const renderTab = (classes: string[] = [], breakpoint = '', onUpdateClasses = vi.fn()) => {
        render(<BordersTab classes={classes} breakpoint={breakpoint} onUpdateClasses={onUpdateClasses} />);
        return onUpdateClasses;
    };

    it('renders all 4 section labels', () => {
        renderTab();

        expect(screen.getByText('Border Width')).toBeInTheDocument();
        expect(screen.getByText('Border Style')).toBeInTheDocument();
        expect(screen.getByText('Border Radius')).toBeInTheDocument();
        expect(screen.getByText('Border Color')).toBeInTheDocument();
    });

    it('border width "1" quirk: clicking the "1" width button adds bare "border", not "border-1"', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Border Width');
        fireEvent.click(within(section).getByText('1px'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(['border'], buildWidthRemoveSweep());
    });

    it('border width remove sweep excludes "border-1" entirely (bare "border" stands in for it)', () => {
        const remove = buildWidthRemoveSweep();
        expect(remove).toEqual(['border', 'border-0', 'border-2', 'border-4', 'border-8']);
    });

    it('border width: clicking a non-1 width (e.g. "2") adds "border-{value}"', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Border Width');
        fireEvent.click(within(section).getByText('2px'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['border-2'], buildWidthRemoveSweep());
    });

    it('border width active state: bare "border" class highlights the "1" button, not "0"', () => {
        renderTab(['border']);

        const section = getSection('Border Width');
        expect(within(section).getByText('1px').className).toMatch(/bg-primary/);
        expect(within(section).getByText('0px').className).not.toMatch(/bg-primary/);
    });

    it('border width active state: "border-2" highlights the "2" button', () => {
        renderTab(['border-2']);

        const section = getSection('Border Width');
        expect(within(section).getByText('2px').className).toMatch(/bg-primary/);
    });

    it('border style: clicking a style sweeps the full BORDER_STYLES set', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Border Style');
        fireEvent.click(within(section).getByText('dashed'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['border-dashed'], buildStyleRemoveSweep());
    });

    it('border style active state: "border-dotted" highlights the dotted button', () => {
        renderTab(['border-dotted']);

        const section = getSection('Border Style');
        expect(within(section).getByText('dotted').className).toMatch(/bg-primary/);
        expect(within(section).getByText('solid').className).not.toMatch(/bg-primary/);
    });

    it('border radius: renders BORDER_RADIUS_LABELS text for every entry (base "" -> "Base")', () => {
        renderTab();

        const section = getSection('Border Radius');
        BORDER_RADIUS.forEach(r => {
            expect(within(section).getByText(BORDER_RADIUS_LABELS[r])).toBeInTheDocument();
        });
    });

    it('border radius base case: clicking "Base" adds bare "rounded", not "rounded-"', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Border Radius');
        fireEvent.click(within(section).getByText('Base'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['rounded'], buildRadiusRemoveSweep());
    });

    it('border radius remove sweep maps the base ("") entry to bare "rounded"', () => {
        const remove = buildRadiusRemoveSweep();
        expect(remove).toEqual([
            'rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg',
            'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full',
        ]);
    });

    it('border radius: clicking a non-base value (e.g. "full") adds "rounded-{value}"', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Border Radius');
        fireEvent.click(within(section).getByText('Full'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['rounded-full'], buildRadiusRemoveSweep());
    });

    it('border radius active state: bare "rounded" class highlights "Base", not "MD"', () => {
        renderTab(['rounded']);

        const section = getSection('Border Radius');
        expect(within(section).getByText('Base').className).toMatch(/bg-primary/);
        expect(within(section).getByText('MD').className).not.toMatch(/bg-primary/);
    });

    it('border radius active state: "rounded-lg" highlights "LG"', () => {
        renderTab(['rounded-lg']);

        const section = getSection('Border Radius');
        expect(within(section).getByText('LG').className).toMatch(/bg-primary/);
    });

    it('breakpoint prefixing: bp=md, border width/style/radius clicks prefix add + full removal sweep', () => {
        const onUpdateClasses = renderTab([], 'md');

        fireEvent.click(within(getSection('Border Width')).getByText('4px'));
        expect(onUpdateClasses).toHaveBeenCalledWith(['md:border-4'], buildWidthRemoveSweep('md:'));

        fireEvent.click(within(getSection('Border Style')).getByText('double'));
        expect(onUpdateClasses).toHaveBeenCalledWith(['md:border-double'], buildStyleRemoveSweep('md:'));

        fireEvent.click(within(getSection('Border Radius')).getByText('SM'));
        expect(onUpdateClasses).toHaveBeenCalledWith(['md:rounded-sm'], buildRadiusRemoveSweep('md:'));
    });

    it('border color: renders one family swatch per the first 16 COLOR_FAMILIES entries only', () => {
        renderTab();

        COLOR_FAMILIES.slice(0, 16).forEach(family => {
            expect(screen.getByTitle(family)).toBeInTheDocument();
        });
        COLOR_FAMILIES.slice(16).forEach(family => {
            expect(screen.queryByTitle(family)).not.toBeInTheDocument();
        });
    });

    it('border color family expansion: clicking a family swatch reveals its shade row; collapses on second click', () => {
        renderTab();

        expect(screen.queryByTitle('border-blue-500')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTitle('blue'));
        COLOR_SHADES.forEach(shade => {
            expect(screen.getByTitle(`border-blue-${shade}`)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle('blue'));
        expect(screen.queryByTitle('border-blue-500')).not.toBeInTheDocument();
    });

    it('applyBorderColor: clicking a shade swatch calls onUpdateClasses with the border-prefixed add + full family/shade sweep', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByTitle('red'));
        fireEvent.click(screen.getByTitle('border-red-600'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(['border-red-600'], buildColorRemoveSweep());
        expect(buildColorRemoveSweep()).toHaveLength(COLOR_FAMILIES.length * COLOR_SHADES.length);
    });

    it('breakpoint prefixing: bp=lg, applyBorderColor prefixes the add class and the full removal sweep', () => {
        const onUpdateClasses = renderTab([], 'lg');

        fireEvent.click(screen.getByTitle('green'));
        fireEvent.click(screen.getByTitle('border-green-300'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['lg:border-green-300'], buildColorRemoveSweep('lg:'));
    });
});
