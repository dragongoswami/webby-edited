import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayoutTab } from './LayoutTab';
import {
    DISPLAY_OPTIONS,
    POSITION_OPTIONS,
    FLEX_DIRECTIONS,
    JUSTIFY_OPTIONS,
    ALIGN_OPTIONS,
    SPACING_SCALE,
} from './tailwind-data';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

/** Locate the section wrapper (label + control row) by its label text. */
function getSection(labelText: string): HTMLElement {
    const label = screen.getByText(labelText);
    return label.parentElement as HTMLElement;
}

describe('LayoutTab', () => {
    const renderTab = (classes: string[] = [], breakpoint = '', onUpdateClasses = vi.fn()) => {
        render(<LayoutTab classes={classes} breakpoint={breakpoint} onUpdateClasses={onUpdateClasses} />);
        return onUpdateClasses;
    };

    it('base render: Display and Position sections are present; Flex/Grid/Gap controls are absent', () => {
        renderTab();

        expect(screen.getByText('Display')).toBeInTheDocument();
        expect(screen.getByText('Position')).toBeInTheDocument();

        expect(screen.queryByText('Direction')).not.toBeInTheDocument();
        expect(screen.queryByText('Justify')).not.toBeInTheDocument();
        expect(screen.queryByText('Align')).not.toBeInTheDocument();
        expect(screen.queryByText('Columns')).not.toBeInTheDocument();
        expect(screen.queryByText(/^Gap/)).not.toBeInTheDocument();
    });

    it('Display applyExact(): clicking a display option sweeps all display values', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Display');
        fireEvent.click(within(section).getByText('Flex'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['flex'],
            DISPLAY_OPTIONS.map(d => d.value),
        );
    });

    it('Position applyExact(): clicking a position option sweeps all position values (buttons render raw value text)', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Position');
        fireEvent.click(within(section).getByText('absolute'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['absolute'],
            POSITION_OPTIONS.map(p => p),
        );
    });

    it('breakpoint prefixing: bp=md, clicking a display option prefixes both add and remove sweep', () => {
        const onUpdateClasses = renderTab([], 'md');

        const section = getSection('Display');
        fireEvent.click(within(section).getByText('Flex'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['md:flex'],
            DISPLAY_OPTIONS.map(d => `md:${d.value}`),
        );
    });

    it('flex gating: classes=["flex"] shows Direction/Justify/Align + Gap, but not Columns', () => {
        renderTab(['flex']);

        expect(screen.getByText('Direction')).toBeInTheDocument();
        expect(screen.getByText('Justify')).toBeInTheDocument();
        expect(screen.getByText('Align')).toBeInTheDocument();
        expect(screen.getByText('Gap')).toBeInTheDocument();
        expect(screen.queryByText('Columns')).not.toBeInTheDocument();
    });

    it('flex gating: classes=["inline-flex"] also shows the flex controls', () => {
        renderTab(['inline-flex']);

        expect(screen.getByText('Direction')).toBeInTheDocument();
        expect(screen.getByText('Justify')).toBeInTheDocument();
        expect(screen.getByText('Align')).toBeInTheDocument();
        expect(screen.getByText('Gap')).toBeInTheDocument();
        expect(screen.queryByText('Columns')).not.toBeInTheDocument();
    });

    it('grid gating: classes=["grid"] shows Columns + Gap, but not the flex controls', () => {
        renderTab(['grid']);

        expect(screen.getByText('Columns')).toBeInTheDocument();
        expect(screen.getByText('Gap')).toBeInTheDocument();
        expect(screen.queryByText('Direction')).not.toBeInTheDocument();
        expect(screen.queryByText('Justify')).not.toBeInTheDocument();
        expect(screen.queryByText('Align')).not.toBeInTheDocument();
    });

    // ANOMALY (documented, not codified as "intended" behavior): DISPLAY_OPTIONS has no
    // 'inline-grid' entry, so findExactClass(classes, DISPLAY_OPTIONS.map(d => d.value), ...)
    // can never resolve activeDisplay to 'inline-grid' — the `isGrid` check's
    // `activeDisplay === 'inline-grid'` branch is dead code. classes=['inline-grid'] therefore
    // does NOT reveal the Grid controls, unlike 'grid'/'flex'/'inline-flex'. This test pins the
    // actual current behavior; see the task summary for the anomaly report.
    it('grid gating anomaly: classes=["inline-grid"] does NOT activate Grid controls (DISPLAY_OPTIONS has no inline-grid entry)', () => {
        renderTab(['inline-grid']);

        expect(screen.queryByText('Columns')).not.toBeInTheDocument();
        expect(screen.queryByText(/^Gap/)).not.toBeInTheDocument();
    });

    it('flex direction applyExact(): clicking a direction sweeps all direction values', () => {
        const onUpdateClasses = renderTab(['flex']);

        const section = getSection('Direction');
        fireEvent.click(within(section).getByText('Row Reverse'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['flex-row-reverse'],
            FLEX_DIRECTIONS.map(d => d.value),
        );
    });

    it('Justify apply(): clicking a justify option sweeps the justify- prefixed values', () => {
        const onUpdateClasses = renderTab(['flex']);

        const section = getSection('Justify');
        fireEvent.click(within(section).getByText('Between'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['justify-between'],
            JUSTIFY_OPTIONS.map(o => `justify-${o.value}`),
        );
    });

    it('Align apply(): clicking an align option sweeps the items- prefixed values', () => {
        const onUpdateClasses = renderTab(['flex']);

        const section = getSection('Align');
        fireEvent.click(within(section).getByText('Stretch'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['items-stretch'],
            ALIGN_OPTIONS.map(o => `items-${o.value}`),
        );
    });

    it('Grid Columns apply(): clicking a column count sweeps the full grid-cols-1..12 set', () => {
        const onUpdateClasses = renderTab(['grid']);

        const section = getSection('Columns');
        fireEvent.click(within(section).getByText('7'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['grid-cols-7'],
            Array.from({ length: 12 }, (_, i) => `grid-cols-${i + 1}`),
        );
    });

    it('gap sweep asymmetry: only the first 20 SPACING_SCALE values render as buttons, but the removal sweep covers the full scale', () => {
        const onUpdateClasses = renderTab(['flex']);

        const section = getSection('Gap');
        const buttons = within(section).getAllByRole('button');
        expect(buttons).toHaveLength(20);

        fireEvent.click(within(section).getByText('4'));

        const expectedRemove = SPACING_SCALE.map(v => `gap-${v}`);
        expect(expectedRemove.length).toBe(SPACING_SCALE.length);
        expect(onUpdateClasses).toHaveBeenCalledWith(['gap-4'], expectedRemove);
    });

    it('gap label: shows "Gap: 4" when a gap value is active, plain "Gap" otherwise', () => {
        renderTab(['flex', 'gap-4']);
        expect(screen.getByText('Gap: 4')).toBeInTheDocument();

        renderTab(['flex']);
        expect(screen.getByText('Gap')).toBeInTheDocument();
    });

    it('active states: the active display, justify, and grid-column buttons get bg-primary', () => {
        const { rerender } = render(
            <LayoutTab classes={['flex']} breakpoint="" onUpdateClasses={vi.fn()} />,
        );
        const displaySection = getSection('Display');
        expect(within(displaySection).getByText('Flex').className).toMatch(/bg-primary/);

        rerender(<LayoutTab classes={['flex', 'justify-center']} breakpoint="" onUpdateClasses={vi.fn()} />);
        const justifySection = getSection('Justify');
        expect(within(justifySection).getByText('Center').className).toMatch(/bg-primary/);

        rerender(<LayoutTab classes={['grid', 'grid-cols-3']} breakpoint="" onUpdateClasses={vi.fn()} />);
        const columnsSection = getSection('Columns');
        expect(within(columnsSection).getByText('3').className).toMatch(/bg-primary/);
    });

    it('breakpoint-scoped gating: classes=["md:flex"] does not activate flex controls at base, but does at breakpoint md', () => {
        const { rerender } = render(
            <LayoutTab classes={['md:flex']} breakpoint="" onUpdateClasses={vi.fn()} />,
        );

        expect(screen.queryByText('Direction')).not.toBeInTheDocument();
        expect(screen.queryByText('Justify')).not.toBeInTheDocument();
        expect(screen.queryByText('Align')).not.toBeInTheDocument();

        rerender(<LayoutTab classes={['md:flex']} breakpoint="md" onUpdateClasses={vi.fn()} />);

        expect(screen.getByText('Direction')).toBeInTheDocument();
        expect(screen.getByText('Justify')).toBeInTheDocument();
        expect(screen.getByText('Align')).toBeInTheDocument();
    });
});
