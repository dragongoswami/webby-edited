/**
 * Tests for ElementToolbar component.
 * Tests the inspector's floating per-element toolbar (button visibility, actions, label, positioning).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ElementToolbar } from '../ElementToolbar';
import type { InspectorElement } from '@/types/inspector';

const mockElement: InspectorElement = {
    id: 'el-123',
    tagName: 'h1',
    elementId: 'hero-title',
    classNames: ['hero-title', 'text-lg'],
    textPreview: 'Welcome',
    xpath: '//*[@id="hero-title"]',
    cssSelector: '#hero-title',
    boundingRect: { top: 100, left: 200, width: 300, height: 50 },
    attributes: {},
    parentTagName: 'div',
};

describe('ElementToolbar', () => {
    describe('Edit Text button', () => {
        it('renders and calls onEdit for a text-editable tag', () => {
            const onEdit = vi.fn();
            render(
                <ElementToolbar
                    element={mockElement}
                    onEdit={onEdit}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const editButton = screen.getByTitle('Edit Text');
            expect(editButton).toBeInTheDocument();

            fireEvent.click(editButton);
            expect(onEdit).toHaveBeenCalledTimes(1);
        });

        it('is absent for a non-text-editable tag', () => {
            render(
                <ElementToolbar
                    element={{ ...mockElement, tagName: 'div' }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            expect(screen.queryByTitle('Edit Text')).toBeNull();
        });
    });

    describe('Image button', () => {
        it('renders and calls onImage for an img tag with onImage provided', () => {
            const onImage = vi.fn();
            render(
                <ElementToolbar
                    element={{ ...mockElement, tagName: 'img' }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onImage={onImage}
                    onClose={vi.fn()}
                />
            );

            const imageButton = screen.getByTitle('Image');
            expect(imageButton).toBeInTheDocument();

            fireEvent.click(imageButton);
            expect(onImage).toHaveBeenCalledTimes(1);
        });

        it('is absent for an img tag without onImage', () => {
            render(
                <ElementToolbar
                    element={{ ...mockElement, tagName: 'img' }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            expect(screen.queryByTitle('Image')).toBeNull();
        });

        it('is absent for a non-img tag even when onImage is passed', () => {
            render(
                <ElementToolbar
                    element={mockElement}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onImage={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            expect(screen.queryByTitle('Image')).toBeNull();
        });
    });

    describe('always-present buttons', () => {
        it('renders Style, AI Edit, and Close buttons and calls their handlers', () => {
            const onStyle = vi.fn();
            const onAiEdit = vi.fn();
            const onClose = vi.fn();

            render(
                <ElementToolbar
                    element={{ ...mockElement, tagName: 'section' }}
                    onEdit={vi.fn()}
                    onStyle={onStyle}
                    onAiEdit={onAiEdit}
                    onClose={onClose}
                />
            );

            const styleButton = screen.getByTitle('Style');
            const aiEditButton = screen.getByTitle('AI Edit');
            const closeButton = screen.getByTitle('Close');

            expect(styleButton).toBeInTheDocument();
            expect(aiEditButton).toBeInTheDocument();
            expect(closeButton).toBeInTheDocument();

            fireEvent.click(styleButton);
            expect(onStyle).toHaveBeenCalledTimes(1);

            fireEvent.click(aiEditButton);
            expect(onAiEdit).toHaveBeenCalledTimes(1);

            fireEvent.click(closeButton);
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('label', () => {
        it('shows tag name with first className when present', () => {
            render(
                <ElementToolbar
                    element={mockElement}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            expect(
                screen.getByText(
                    (_, el) => el?.tagName === 'SPAN' && el.textContent === '<h1.hero-title>'
                )
            ).toBeInTheDocument();
        });

        it('shows tag name only (no dot) when classNames is empty', () => {
            render(
                <ElementToolbar
                    element={{ ...mockElement, tagName: 'div', classNames: [] }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            expect(
                screen.getByText(
                    (_, el) => el?.tagName === 'SPAN' && el.textContent === '<div>'
                )
            ).toBeInTheDocument();
        });
    });

    describe('touch targets', () => {
        it('sizes every icon button at the h-9 w-9 floor and uses the logical me-1 spacing on the label', () => {
            render(
                <ElementToolbar
                    element={mockElement}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            for (const title of ['Edit Text', 'Style', 'AI Edit', 'Close']) {
                const button = screen.getByTitle(title);
                expect(button.className).toContain('h-9');
                expect(button.className).toContain('w-9');
            }

            const label = screen.getByText(
                (_, el) => el?.tagName === 'SPAN' && (el.textContent ?? '').startsWith('<h1')
            );
            expect(label.className).toContain('me-1');
            expect(label.className).not.toContain('mr-1');
        });

        it('also sizes the Image button at h-9 w-9 for an img element', () => {
            render(
                <ElementToolbar
                    element={{ ...mockElement, tagName: 'img' }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onImage={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const imageButton = screen.getByTitle('Image');
            expect(imageButton.className).toContain('h-9');
            expect(imageButton.className).toContain('w-9');
        });
    });

    describe('positioning', () => {
        it('clamps top and left to a minimum of 8px', () => {
            const { container } = render(
                <ElementToolbar
                    element={{
                        ...mockElement,
                        boundingRect: { top: 10, left: 4, width: 300, height: 50 },
                    }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const toolbar = container.firstChild as HTMLElement;
            expect(toolbar.style.top).toBe('8px');
            expect(toolbar.style.left).toBe('8px');
        });

        it('positions above and at the left of the element when there is enough room', () => {
            const { container } = render(
                <ElementToolbar
                    element={{
                        ...mockElement,
                        boundingRect: { top: 100, left: 200, width: 300, height: 50 },
                    }}
                    onEdit={vi.fn()}
                    onStyle={vi.fn()}
                    onAiEdit={vi.fn()}
                    onClose={vi.fn()}
                />
            );

            const toolbar = container.firstChild as HTMLElement;
            expect(toolbar.style.top).toBe('56px');
            expect(toolbar.style.left).toBe('200px');
        });
    });
});
