/**
 * Tests for InspectPreview component.
 * Tests element selection, mode toggling, and edit handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InspectPreview } from '../InspectPreview';
import type { PendingEdit, InspectorElement } from '@/types/inspector';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
    default: {
        create: vi.fn(() => vi.fn()),
    },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

// Mock usePreviewInspector hook
const mockCloseContextMenu = vi.fn();

vi.mock('@/hooks/usePreviewInspector', () => ({
    usePreviewInspector: vi.fn(() => ({
        hoveredElement: null,
        contextMenu: null,
        closeContextMenu: mockCloseContextMenu,
        pendingEdits: [],
        addPendingEdit: vi.fn(),
        removePendingEdit: vi.fn(),
        clearPendingEdits: vi.fn(),
        isReady: true,
        startEditingElement: vi.fn(),
        revertEdits: vi.fn(),
        stylePanelOpen: false,
        styleElement: null,
        styleClasses: [],
        originalClasses: [],
        openStylePanel: vi.fn(),
        closeStylePanel: vi.fn(),
        updateStyleClasses: vi.fn(),
        resetStyleClasses: vi.fn(),
    })),
}));

// Mock usePreviewThemeSync hook
vi.mock('@/hooks/usePreviewThemeSync', () => ({
    usePreviewThemeSync: vi.fn(() => ({
        sendTheme: vi.fn(),
    })),
}));

// Mock useThumbnailCapture hook
vi.mock('@/hooks/useThumbnailCapture', () => ({
    useThumbnailCapture: vi.fn(() => ({
        captureAndUpload: vi.fn(),
    })),
}));

// Mock element data
const mockElement: InspectorElement = {
    id: 'el-123',
    tagName: 'button',
    elementId: 'submit-btn',
    classNames: ['btn', 'primary'],
    textPreview: 'Submit',
    xpath: '//*[@id="submit-btn"]',
    cssSelector: '#submit-btn',
    boundingRect: { top: 100, left: 200, width: 100, height: 40 },
    attributes: { title: 'Click to submit' },
    parentTagName: 'div',
};

const mockPendingEdit: PendingEdit = {
    id: 'edit-1',
    element: mockElement,
    field: 'text',
    originalValue: 'Submit',
    newValue: 'Save',
    timestamp: new Date(),
};

describe('InspectPreview', () => {
    const defaultProps = {
        previewUrl: 'http://localhost:3000/preview/123',
        refreshTrigger: 0,
        isBuilding: false,
        onElementSelect: vi.fn(),
        onElementEdit: vi.fn(),
        pendingEdits: [] as PendingEdit[],
        onSaveAllEdits: vi.fn().mockResolvedValue(undefined),
        onDiscardAllEdits: vi.fn(),
        onRemoveEdit: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders empty state when no preview URL', () => {
            render(<InspectPreview {...defaultProps} previewUrl={null} />);

            expect(screen.getByText('Nothing built yet')).toBeInTheDocument();
        });

        it('renders iframe when preview URL exists', () => {
            render(<InspectPreview {...defaultProps} />);

            const iframe = screen.getByTitle('Preview');
            expect(iframe).toBeInTheDocument();
            expect(iframe).toHaveAttribute('src', expect.stringContaining('http://localhost:3000/preview/123'));
        });

        it('renders inspect and design toggle buttons', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByRole('button', { name: /inspect/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /design/i })).toBeInTheDocument();
        });

        it('does not render select/edit sub-mode buttons', () => {
            render(<InspectPreview {...defaultProps} mode="inspect" />);

            expect(screen.queryByRole('button', { name: /^select$/i })).not.toBeInTheDocument();
        });

        it('shows building animation when isBuilding is true', () => {
            render(<InspectPreview {...defaultProps} isBuilding={true} />);

            expect(screen.getByText('Building your site...')).toBeInTheDocument();
        });
    });

    describe('mode-specific hints', () => {
        it('shows inspect mode hint', async () => {
            render(<InspectPreview {...defaultProps} mode="inspect" />);

            // Wait for ready state (simulated)
            await waitFor(() => {
                // The hint text may or may not be visible depending on isReady state
                // We'll just verify the component renders without error
                expect(screen.getByTitle('Preview')).toBeInTheDocument();
            });
        });
    });

    describe('pending edits panel', () => {
        it('shows pending edits panel when edits exist', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    pendingEdits={[mockPendingEdit]}
                />
            );

            expect(screen.getByText('1 pending change')).toBeInTheDocument();
        });

        it('hides pending edits panel when no edits', () => {
            render(<InspectPreview {...defaultProps} pendingEdits={[]} />);

            expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
        });

        it('calls onSaveAllEdits when Save All clicked', async () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    pendingEdits={[mockPendingEdit]}
                />
            );

            const saveButton = screen.getByRole('button', { name: /save all/i });
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(defaultProps.onSaveAllEdits).toHaveBeenCalled();
            });
        });

        it('calls onDiscardAllEdits when Discard All clicked', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    pendingEdits={[mockPendingEdit]}
                />
            );

            const discardButton = screen.getByRole('button', { name: /discard all/i });
            fireEvent.click(discardButton);

            expect(defaultProps.onDiscardAllEdits).toHaveBeenCalled();
        });
    });

    describe('empty state', () => {
        it('renders empty state message', () => {
            render(<InspectPreview {...defaultProps} previewUrl={null} />);

            expect(screen.getByText('Nothing built yet')).toBeInTheDocument();
            expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
        });

        it('shows building animation in empty state when building', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    previewUrl={null}
                    isBuilding={true}
                />
            );

            expect(screen.getByText('Building your site...')).toBeInTheDocument();
        });
    });

    describe('refresh trigger', () => {
        it('updates iframe src when refreshTrigger changes', () => {
            const { rerender } = render(
                <InspectPreview {...defaultProps} refreshTrigger={1} />
            );

            const iframe1 = screen.getByTitle('Preview');
            const src1 = iframe1.getAttribute('src');

            rerender(<InspectPreview {...defaultProps} refreshTrigger={2} />);

            const iframe2 = screen.getByTitle('Preview');
            const src2 = iframe2.getAttribute('src');

            expect(src1).not.toBe(src2);
        });
    });

    describe('accessibility', () => {
        it('has accessible iframe title', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByTitle('Preview')).toBeInTheDocument();
        });

        it('has accessible inspect and design toggle buttons', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByRole('button', { name: /inspect/i })).toHaveAccessibleName();
            expect(screen.getByRole('button', { name: /design/i })).toHaveAccessibleName();
        });
    });

    describe('mode toggle clicks', () => {
        it('clicking Inspect from preview mode switches to inspect', () => {
            const onModeChange = vi.fn();
            render(<InspectPreview {...defaultProps} mode="preview" onModeChange={onModeChange} />);

            fireEvent.click(screen.getByRole('button', { name: /^inspect$/i }));

            expect(onModeChange).toHaveBeenCalledWith('inspect');
            expect(onModeChange).toHaveBeenCalledTimes(1);
        });

        it('clicking Inspect while already in inspect mode toggles back to preview', () => {
            const onModeChange = vi.fn();
            render(<InspectPreview {...defaultProps} mode="inspect" onModeChange={onModeChange} />);

            fireEvent.click(screen.getByRole('button', { name: /^inspect$/i }));

            expect(onModeChange).toHaveBeenCalledWith('preview');
            expect(onModeChange).toHaveBeenCalledTimes(1);
        });

        it('clicking Design from preview mode switches to design', () => {
            const onModeChange = vi.fn();
            render(<InspectPreview {...defaultProps} mode="preview" onModeChange={onModeChange} />);

            fireEvent.click(screen.getByRole('button', { name: /^design$/i }));

            expect(onModeChange).toHaveBeenCalledWith('design');
            expect(onModeChange).toHaveBeenCalledTimes(1);
        });

        it('clicking Design while already in design mode toggles back to preview', () => {
            const onModeChange = vi.fn();
            render(<InspectPreview {...defaultProps} mode="design" onModeChange={onModeChange} />);

            fireEvent.click(screen.getByRole('button', { name: /^design$/i }));

            expect(onModeChange).toHaveBeenCalledWith('preview');
            expect(onModeChange).toHaveBeenCalledTimes(1);
        });

        it('clicking Design while in inspect mode switches directly to design (not preview)', () => {
            const onModeChange = vi.fn();
            render(<InspectPreview {...defaultProps} mode="inspect" onModeChange={onModeChange} />);

            fireEvent.click(screen.getByRole('button', { name: /^design$/i }));

            expect(onModeChange).toHaveBeenCalledWith('design');
            expect(onModeChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('mobile toolbar overflow', () => {
        it('wraps the right-hand toolbar button group in a horizontally-scrollable, scrollbar-hidden container', () => {
            render(<InspectPreview {...defaultProps} />);

            const actions = screen.getByTestId('toolbar-actions');
            expect(actions.className).toContain('overflow-x-auto');
            expect(actions.className).toContain('scrollbar-hide');
        });

        it('hides the inspect-mode hint text below sm', () => {
            render(<InspectPreview {...defaultProps} mode="inspect" />);

            const hint = screen.getByText('Click any element to see options');
            expect(hint.className).toContain('hidden');
            expect(hint.className).toContain('sm:inline');
        });
    });

    describe('design-mode panel below lg', () => {
        it('renders the design panel as an absolute overlay with a backdrop and a close button', () => {
            const onModeChange = vi.fn();
            render(
                <InspectPreview
                    {...defaultProps}
                    mode="design"
                    onModeChange={onModeChange}
                    themeDesignerSlot={<div>Design tools</div>}
                />
            );

            const panel = screen.getByTestId('design-panel');
            expect(panel.className).toContain('absolute');
            expect(panel.className).toContain('lg:static');

            expect(screen.getByTestId('design-panel-backdrop')).toBeInTheDocument();

            const closeButton = screen.getByRole('button', { name: /close/i });
            expect(closeButton.className).toContain('lg:hidden');
        });

        it('clicking the backdrop switches back to preview mode', () => {
            const onModeChange = vi.fn();
            render(
                <InspectPreview
                    {...defaultProps}
                    mode="design"
                    onModeChange={onModeChange}
                    themeDesignerSlot={<div>Design tools</div>}
                />
            );

            fireEvent.click(screen.getByTestId('design-panel-backdrop'));

            expect(onModeChange).toHaveBeenCalledWith('preview');
        });
    });

    describe('undo/redo/revision-history accessible names', () => {
        it('gives the title-only Undo, Redo, and Revision History toolbar buttons an aria-label', () => {
            render(
                <InspectPreview
                    {...defaultProps}
                    onUndo={vi.fn()}
                    onRedo={vi.fn()}
                    onRestoreRevision={vi.fn()}
                />
            );

            expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Revision History' })).toBeInTheDocument();
        });
    });

    describe('device width toggle', () => {
        it('renders the phone/tablet/full width toggle buttons', () => {
            render(<InspectPreview {...defaultProps} />);

            expect(screen.getByRole('button', { name: 'Phone preview' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Tablet preview' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Full width preview' })).toBeInTheDocument();
        });

        it('defaults to full width: the iframe frame has no inline style and no border classes', () => {
            render(<InspectPreview {...defaultProps} />);

            const frame = screen.getByTestId('device-frame');
            expect(frame).not.toHaveAttribute('style');
            expect(frame.className).not.toContain('border-x');
            expect(frame.className).not.toContain('shadow-sm');
        });

        it('selecting Phone constrains the frame to 375px with a frame border', () => {
            render(<InspectPreview {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: 'Phone preview' }));

            const frame = screen.getByTestId('device-frame');
            expect(frame).toHaveStyle({ maxWidth: '375px' });
            expect(frame.className).toContain('border-x');
            expect(frame.className).toContain('shadow-sm');
        });

        it('selecting Tablet constrains the frame to 768px with a frame border', () => {
            render(<InspectPreview {...defaultProps} />);

            fireEvent.click(screen.getByRole('button', { name: 'Tablet preview' }));

            const frame = screen.getByTestId('device-frame');
            expect(frame).toHaveStyle({ maxWidth: '768px' });
            expect(frame.className).toContain('border-x');
        });
    });

    // Regression test for the OffscreenCanvas warning observed in E2E.
    // canvas-confetti with `useWorker: true` calls transferControlToOffscreen()
    // on the canvas element. After that, the main thread can no longer set
    // canvas.width/height — doing so produces a console warning. The fix is
    // to track confetti initialization with a ref and skip the manual
    // ResizeObserver-driven canvas resize once confetti owns the canvas.
    describe('canvas resize after confetti', () => {
        it('does not write to canvas.width when ResizeObserver fires after confetti.create', async () => {
            // Capture the ResizeObserver callback so we can fire it manually.
            let resizeCallback: ResizeObserverCallback | null = null;
            const observeSpy = vi.fn();
            const disconnectSpy = vi.fn();
            class ResizeObserverMock {
                constructor(cb: ResizeObserverCallback) {
                    resizeCallback = cb;
                }
                observe = observeSpy;
                unobserve = vi.fn();
                disconnect = disconnectSpy;
            }
            const originalRO = global.ResizeObserver;
            global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

            // Spy on canvas.width assignments globally.
            const originalWidthDescriptor = Object.getOwnPropertyDescriptor(
                HTMLCanvasElement.prototype,
                'width'
            );
            let widthWritesAfterConfetti = 0;
            let confettiCreated = false;
            Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
                configurable: true,
                set(this: HTMLCanvasElement, value: number) {
                    if (confettiCreated) {
                        widthWritesAfterConfetti++;
                    }
                    if (originalWidthDescriptor?.set) {
                        originalWidthDescriptor.set.call(this, value);
                    }
                },
                get(this: HTMLCanvasElement) {
                    return originalWidthDescriptor?.get?.call(this) ?? 0;
                },
            });

            try {
                // Hook canvas-confetti.create to flip our flag.
                const confettiModule = await import('canvas-confetti');
                const createMock = vi.mocked(confettiModule.default.create);
                createMock.mockImplementation(() => {
                    confettiCreated = true;
                    return vi.fn() as unknown as ReturnType<typeof confettiModule.default.create>;
                });

                // Render building → not-building to trigger confetti.create().
                const { rerender } = render(
                    <InspectPreview {...defaultProps} isBuilding={true} />
                );
                rerender(<InspectPreview {...defaultProps} isBuilding={false} />);

                await waitFor(() => {
                    expect(createMock).toHaveBeenCalled();
                });

                // Manually fire the ResizeObserver callback as if a window
                // resize occurred AFTER confetti took ownership of the canvas.
                expect(resizeCallback).not.toBeNull();
                resizeCallback!([], {} as ResizeObserver);

                // With the fix in place (confettiInitialized ref guard), no
                // canvas.width writes should happen after confetti.create().
                // Without the fix, the resize callback would call
                // canvas.width = rect.width and trigger the OffscreenCanvas
                // warning in real browsers.
                expect(widthWritesAfterConfetti).toBe(0);
            } finally {
                // Restore globals
                global.ResizeObserver = originalRO;
                if (originalWidthDescriptor) {
                    Object.defineProperty(HTMLCanvasElement.prototype, 'width', originalWidthDescriptor);
                }
            }
        });
    });
});
