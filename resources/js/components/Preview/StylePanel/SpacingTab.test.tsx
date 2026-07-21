import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SpacingTab } from './SpacingTab';
import { SPACING_SCALE } from './tailwind-data';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

/**
 * Locate the section wrapper (label + control row) by its label text. Matches labels that
 * start with the given text, since the "Value" label appends the active value (e.g. "Value: 4").
 */
function getSection(labelText: string): HTMLElement {
    const label = screen.getByText(new RegExp(`^${labelText}`));
    return label.parentElement as HTMLElement;
}

/** Build the exact removal sweep `apply()` performs for a given prefix/breakpoint. */
function buildRemoveSweep(prefix: string, bp = ''): string[] {
    const remove = SPACING_SCALE.map(v => `${bp}${prefix}${v}`);
    remove.push(`${bp}${prefix}auto`);
    return remove;
}

describe('SpacingTab', () => {
    const renderTab = (classes: string[] = [], breakpoint = '', onUpdateClasses = vi.fn()) => {
        render(<SpacingTab classes={classes} breakpoint={breakpoint} onUpdateClasses={onUpdateClasses} />);
        return onUpdateClasses;
    };

    it('default mode/side: Padding is active, side "All" is active, prefix is "p-"', () => {
        const onUpdateClasses = renderTab();

        expect(screen.getByText('Padding').className).toMatch(/bg-primary/);
        expect(screen.getByText('All').className).toMatch(/bg-primary/);

        const valueSection = getSection('Value');
        fireEvent.click(within(valueSection).getByText('4'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(['p-4'], buildRemoveSweep('p-'));
    });

    it('the removal sweep pins the "auto" extra appended after the full SPACING_SCALE sweep', () => {
        const remove = buildRemoveSweep('p-');

        expect(remove).toHaveLength(SPACING_SCALE.length + 1);
        expect(remove[remove.length - 1]).toBe('p-auto');
    });

    it('side "x": clicking a side button switches the prefix to "px-"', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByText('X'));
        const valueSection = getSection('Value');
        fireEvent.click(within(valueSection).getByText('8'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['px-8'], buildRemoveSweep('px-'));
    });

    it('mode margin + side "t": prefix becomes "mt-"', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByText('Margin'));
        fireEvent.click(screen.getByText('T'));
        const valueSection = getSection('Value');
        fireEvent.click(within(valueSection).getByText('2'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['mt-2'], buildRemoveSweep('mt-'));
    });

    it('mode "gap": prefix becomes "gap-" and the Side selector is hidden', () => {
        const onUpdateClasses = renderTab();

        expect(screen.getByText('Side')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Gap'));

        expect(screen.queryByText('Side')).not.toBeInTheDocument();

        const valueSection = getSection('Value');
        fireEvent.click(within(valueSection).getByText('6'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['gap-6'], buildRemoveSweep('gap-'));
    });

    it('gap force-resets side to "all": margin+side "x" then gap then back to margin yields "m-", not "mx-"', () => {
        const onUpdateClasses = renderTab();

        fireEvent.click(screen.getByText('Margin'));
        fireEvent.click(screen.getByText('X'));
        fireEvent.click(screen.getByText('Gap'));
        fireEvent.click(screen.getByText('Margin'));

        // The Side selector is visible again under margin, and "All" is active (side was reset).
        expect(screen.getByText('All').className).toMatch(/bg-primary/);

        const valueSection = getSection('Value');
        fireEvent.click(within(valueSection).getByText('3'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['m-3'], buildRemoveSweep('m-'));
    });

    it('breakpoint prefixing: bp=md, padding side all, clicking a value prefixes both add and the full remove sweep', () => {
        const onUpdateClasses = renderTab([], 'md');

        const valueSection = getSection('Value');
        fireEvent.click(within(valueSection).getByText('4'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['md:p-4'], buildRemoveSweep('p-', 'md:'));
    });

    it('active value highlight: the button matching the current class gets bg-primary via findClassValue', () => {
        renderTab(['p-4']);

        const valueSection = getSection('Value');
        expect(within(valueSection).getByText('4').className).toMatch(/bg-primary/);
        expect(within(valueSection).getByText('8').className).not.toMatch(/bg-primary/);
    });

    it('active value label: shows "Value: 4" when a value is active', () => {
        renderTab(['p-4']);
        expect(screen.getByText('Value: 4')).toBeInTheDocument();
    });

    it('active value label: shows plain "Value" when no value is active', () => {
        renderTab([]);
        expect(screen.getByText('Value')).toBeInTheDocument();
    });

    it('margin "auto" button: not present in the default padding mode', () => {
        renderTab();
        expect(screen.queryByText('auto')).not.toBeInTheDocument();
    });

    it('margin "auto" button: clicking it in margin mode sweeps the scale + auto and adds "m-auto"', () => {
        const onUpdateClasses = renderTab();
        fireEvent.click(screen.getByText('Margin'));
        fireEvent.click(screen.getByText('auto'));

        expect(onUpdateClasses).toHaveBeenCalledWith(['m-auto'], buildRemoveSweep('m-'));
    });

    it('margin "auto" active highlight: classes=["m-auto"] highlights the auto button via findClassValue', () => {
        renderTab(['m-auto']);

        fireEvent.click(screen.getByText('Margin'));

        expect(screen.getByText('auto').className).toMatch(/bg-primary/);
        expect(screen.getByText('Value: auto')).toBeInTheDocument();
    });

    it('padding/gap modes do not render the margin-only "auto" button', () => {
        renderTab();
        expect(screen.queryByText('auto')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Gap'));
        expect(screen.queryByText('auto')).not.toBeInTheDocument();
    });
});
