import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TypographyTab } from './TypographyTab';
import { FONT_SIZES, FONT_WEIGHTS, TEXT_ALIGNS, LINE_HEIGHTS, LETTER_SPACINGS } from './tailwind-data';

// The global test setup mocks useTranslation (identity-ish with :param interpolation).

/** Locate the section wrapper (label + control row) by its label text. */
function getSection(labelText: string): HTMLElement {
    const label = screen.getByText(labelText);
    return label.parentElement as HTMLElement;
}

describe('TypographyTab', () => {
    const renderTab = (classes: string[] = [], breakpoint = '', onUpdateClasses = vi.fn()) => {
        render(<TypographyTab classes={classes} breakpoint={breakpoint} onUpdateClasses={onUpdateClasses} />);
        return onUpdateClasses;
    };

    it('renders all 8 section labels', () => {
        renderTab();

        [
            'Font Family',
            'Font Size',
            'Font Weight',
            'Text Align',
            'Line Height',
            'Letter Spacing',
            'Text Transform',
            'Text Decoration',
        ].forEach(label => {
            expect(screen.getByText(label)).toBeInTheDocument();
        });
    });

    it('apply() sweeps all font sizes when adding one (base, no breakpoint)', () => {
        const onUpdateClasses = renderTab();

        const sizeSection = getSection('Font Size');
        fireEvent.click(within(sizeSection).getByText('xl'));

        expect(onUpdateClasses).toHaveBeenCalledTimes(1);
        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['text-xl'],
            FONT_SIZES.map(s => `text-${s}`),
        );
    });

    it('apply() prefixes both the added class and the removal sweep with the breakpoint', () => {
        const onUpdateClasses = renderTab([], 'md');

        const sizeSection = getSection('Font Size');
        fireEvent.click(within(sizeSection).getByText('xl'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['md:text-xl'],
            FONT_SIZES.map(s => `md:text-${s}`),
        );
    });

    it('applyExact() sweeps the fixed family list when clicking a font family', () => {
        const onUpdateClasses = renderTab();

        const familySection = getSection('Font Family');
        fireEvent.click(within(familySection).getByText('serif'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['font-serif'],
            ['font-sans', 'font-serif', 'font-mono'],
        );
    });

    it('applyExact() bp-prefixes the family sweep when a breakpoint is active', () => {
        const onUpdateClasses = renderTab([], 'lg');

        const familySection = getSection('Font Family');
        fireEvent.click(within(familySection).getByText('serif'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['lg:font-serif'],
            ['lg:font-sans', 'lg:font-serif', 'lg:font-mono'],
        );
    });

    it('font weight click sweeps all weight values', () => {
        const onUpdateClasses = renderTab();

        const weightSection = getSection('Font Weight');
        fireEvent.click(within(weightSection).getByText('Bold'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['font-bold'],
            FONT_WEIGHTS.map(w => `font-${w.value}`),
        );
    });

    it('text align buttons are icon-only with aria-labels, and clicking one sweeps all aligns', () => {
        const onUpdateClasses = renderTab();

        expect(screen.getByRole('button', { name: 'Align left' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Align right' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Justify' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Align center' }));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['text-center'],
            TEXT_ALIGNS.map(a => `text-${a}`),
        );
    });

    it('line height click sweeps all line-height values', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Line Height');
        fireEvent.click(within(section).getByText('Tight (1.25)'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['leading-tight'],
            LINE_HEIGHTS.map(l => `leading-${l.value}`),
        );
    });

    it('letter spacing click sweeps all letter-spacing values', () => {
        const onUpdateClasses = renderTab();

        const section = getSection('Letter Spacing');
        fireEvent.click(within(section).getByText('Wide'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['tracking-wide'],
            LETTER_SPACINGS.map(l => `tracking-${l.value}`),
        );
    });

    it('highlights the active font size button and not the others', () => {
        renderTab(['text-xl']);

        const section = getSection('Font Size');
        const activeButton = within(section).getByText('xl');
        const otherButton = within(section).getByText('lg');

        expect(activeButton.className).toMatch(/bg-primary/);
        expect(otherButton.className).not.toMatch(/bg-primary/);
    });

    it('prefix-collision guard: a color class (text-blue-600) does not activate any size button', () => {
        renderTab(['text-blue-600']);

        const section = getSection('Font Size');
        FONT_SIZES.forEach(size => {
            expect(within(section).getByText(size).className).not.toMatch(/bg-primary/);
        });
    });

    it('prefix-collision guard: text-center activates align but no size button', () => {
        renderTab(['text-center']);

        const sizeSection = getSection('Font Size');
        FONT_SIZES.forEach(size => {
            expect(within(sizeSection).getByText(size).className).not.toMatch(/bg-primary/);
        });

        expect(screen.getByRole('button', { name: 'Align center' }).className).toMatch(/bg-primary/);
    });

    it('prefix-collision guard: font-serif activates family but no weight button', () => {
        renderTab(['font-serif']);

        const familySection = getSection('Font Family');
        expect(within(familySection).getByText('serif').className).toMatch(/bg-primary/);

        const weightSection = getSection('Font Weight');
        FONT_WEIGHTS.forEach(w => {
            expect(within(weightSection).getByText(w.label).className).not.toMatch(/bg-primary/);
        });
    });

    it('breakpoint-scoped active detection: a md-prefixed class is not active at base, but is active at md', () => {
        const { rerender } = render(
            <TypographyTab classes={['md:text-xl']} breakpoint="" onUpdateClasses={vi.fn()} />,
        );

        let section = getSection('Font Size');
        expect(within(section).getByText('xl').className).not.toMatch(/bg-primary/);

        rerender(<TypographyTab classes={['md:text-xl']} breakpoint="md" onUpdateClasses={vi.fn()} />);

        section = getSection('Font Size');
        expect(within(section).getByText('xl').className).toMatch(/bg-primary/);
    });

    it('text transform: uppercase is active via includes(); clicking capitalize sweeps the fixed list', () => {
        const onUpdateClasses = renderTab(['uppercase']);

        const section = getSection('Text Transform');
        expect(within(section).getByText('uppercase').className).toMatch(/bg-primary/);
        expect(within(section).getByText('None')).toBeInTheDocument();

        fireEvent.click(within(section).getByText('capitalize'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['capitalize'],
            ['normal-case', 'uppercase', 'lowercase', 'capitalize'],
        );
    });

    it('text decoration: no-underline renders as None; clicking underline sweeps the fixed list', () => {
        const onUpdateClasses = renderTab(['no-underline']);

        const section = getSection('Text Decoration');
        expect(within(section).getByText('None')).toBeInTheDocument();

        fireEvent.click(within(section).getByText('underline'));

        expect(onUpdateClasses).toHaveBeenCalledWith(
            ['underline'],
            ['no-underline', 'underline', 'line-through'],
        );
    });
});
