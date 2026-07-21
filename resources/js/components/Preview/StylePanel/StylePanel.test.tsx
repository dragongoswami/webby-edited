import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StylePanel } from './StylePanel';
import type { InspectorElement } from '@/types/inspector';

const langState = vi.hoisted(() => ({ isRtl: false }));

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s, isRtl: langState.isRtl }),
}));

const stubElement: InspectorElement = {
    tagName: 'h1',
    classNames: ['text-5xl'],
    id: '',
    text: 'Hero',
    selector: 'h1',
    rect: { top: 0, left: 0, width: 0, height: 0 } as DOMRect,
    attributes: {},
    computedStyles: {},
};

function renderPanel() {
    return render(
        <StylePanel
            element={stubElement}
            classes={['text-5xl', 'font-bold']}
            onUpdateClasses={vi.fn()}
            onApply={vi.fn()}
            onReset={vi.fn()}
            onClose={vi.fn()}
        />,
    );
}

describe('StylePanel layout', () => {
    afterEach(() => {
        langState.isRtl = false;
    });

    it('slides in from the anchored edge: right in LTR, left in RTL', () => {
        langState.isRtl = false;
        const ltr = renderPanel();
        expect(ltr.container.querySelector('div.absolute')?.className).toContain('slide-in-from-right-5');
        ltr.unmount();

        langState.isRtl = true;
        const rtl = renderPanel();
        expect(rtl.container.querySelector('div.absolute')?.className).toContain('slide-in-from-left-5');
        expect(rtl.container.querySelector('div.absolute')?.className).not.toContain('slide-in-from-right-5');
        langState.isRtl = false;
        rtl.unmount();
    });

    it('non-scrollable chrome rows do not shrink (flex-shrink-0)', () => {
        const { container } = renderPanel();
        const panel = container.querySelector('div.absolute');
        expect(panel).toBeTruthy();

        // Gather direct children: header, tab bar, breakpoint bar wrapper,
        // scroll area, separator wrapper, footer.
        const children = panel ? Array.from(panel.children) : [];
        const nonScroll = children.filter(el => !el.className.includes('flex-1'));
        for (const el of nonScroll) {
            expect(el.className).toMatch(/flex-shrink-0/);
        }
    });

    it('ScrollArea wrapper grows and allows min-height:0 so siblings stay visible', () => {
        const { container } = renderPanel();
        const panel = container.querySelector('div.absolute');
        expect(panel).toBeTruthy();

        const directChildren = panel ? Array.from(panel.children) : [];
        const scrollAreaWrapper = directChildren.find(
            el => el.className.includes('flex-1') && !el.className.includes('flex-shrink-0'),
        );
        expect(scrollAreaWrapper).toBeTruthy();
        expect(scrollAreaWrapper?.className).toMatch(/min-h-0/);
    });

    it('Reset and Apply buttons render inside the panel', () => {
        const { container, getByRole } = renderPanel();
        const panel = container.querySelector('div.absolute');
        const apply = getByRole('button', { name: /apply/i });
        const reset = getByRole('button', { name: /reset/i });
        expect(panel?.contains(apply)).toBe(true);
        expect(panel?.contains(reset)).toBe(true);
    });

    it('is bounded to the viewport width and anchored with a logical inline-end offset (not a physical `right`)', () => {
        const { container } = renderPanel();
        const panel = container.querySelector('div.absolute');
        expect(panel).toBeTruthy();
        expect(panel?.className).toContain('max-w-[calc(100vw-2rem)]');
        expect(panel?.className).toContain('end-4');
        expect(panel?.className).not.toMatch(/(^|\s)right-4(\s|$)/);
        expect(panel?.className).not.toMatch(/(^|\s)fixed(\s|$)/);
    });
});
