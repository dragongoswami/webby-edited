/**
 * Tests for WordPressPlaygroundPreview.
 * Verifies the Site Editor toolbar button renders and stays disabled until
 * the Playground client reaches the 'ready' phase. The boot effect's theme
 * fetch is stubbed to reject under jsdom, which the component catches (error
 * phase) — the toolbar renders regardless of phase.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s }),
}));
vi.mock('@/components/Preview/RevisionHistoryPanel', () => ({
    RevisionHistoryPanel: ({ open }: { open: boolean }) => (open ? <div data-testid="rev-panel-open" /> : null),
}));
vi.mock('@/components/Preview/BuildingAnimation', () => ({
    BuildingAnimation: () => null,
}));

import { WordPressPlaygroundPreview } from './WordPressPlaygroundPreview';

describe('WordPressPlaygroundPreview', () => {
    beforeEach(() => {
        // The boot effect fetches the theme zip first; stub it so the test
        // never hits the network and resolves the phase deterministically.
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('stubbed')));
    });

    it('renders a Site Editor button, disabled until Playground is ready', () => {
        render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
        const btn = screen.getByTitle('Edit in Site Editor');
        expect(btn).toBeDisabled();
    });

    describe('Undo button', () => {
        it('is not rendered when onUndo is omitted', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
            expect(screen.queryByTitle(/^Undo/)).toBeNull();
        });

        it('is rendered when onUndo is provided and calls it on click', () => {
            const onUndo = vi.fn();
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" onUndo={onUndo} />);
            const btn = screen.getByTitle(/^Undo/);
            expect(btn).toBeInTheDocument();
            fireEvent.click(btn);
            expect(onUndo).toHaveBeenCalledTimes(1);
        });

        it('is disabled and shows a spinner while isUndoing', () => {
            render(
                <WordPressPlaygroundPreview
                    themeZipUrl="/preview/x/wp-theme.zip"
                    onUndo={vi.fn()}
                    isUndoing
                />,
            );
            const btn = screen.getByTitle(/^Undo/);
            expect(btn).toBeDisabled();
            expect(btn.querySelector('.animate-spin')).not.toBeNull();
        });

        it('is disabled when isUndoRedoDisabled is true (not undoing)', () => {
            render(
                <WordPressPlaygroundPreview
                    themeZipUrl="/preview/x/wp-theme.zip"
                    onUndo={vi.fn()}
                    isUndoRedoDisabled
                />,
            );
            const btn = screen.getByTitle(/^Undo/);
            expect(btn).toBeDisabled();
        });

        it('is enabled and shows no spinner by default', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" onUndo={vi.fn()} />);
            const btn = screen.getByTitle(/^Undo/);
            expect(btn).not.toBeDisabled();
            expect(btn.querySelector('.animate-spin')).toBeNull();
        });
    });

    describe('Redo button', () => {
        it('is not rendered when onRedo is omitted', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
            expect(screen.queryByTitle(/^Redo/)).toBeNull();
        });

        it('is rendered when onRedo is provided and calls it on click', () => {
            const onRedo = vi.fn();
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" onRedo={onRedo} />);
            const btn = screen.getByTitle(/^Redo/);
            expect(btn).toBeInTheDocument();
            fireEvent.click(btn);
            expect(onRedo).toHaveBeenCalledTimes(1);
        });

        it('is disabled and shows a spinner while isRedoing', () => {
            render(
                <WordPressPlaygroundPreview
                    themeZipUrl="/preview/x/wp-theme.zip"
                    onRedo={vi.fn()}
                    isRedoing
                />,
            );
            const btn = screen.getByTitle(/^Redo/);
            expect(btn).toBeDisabled();
            expect(btn.querySelector('.animate-spin')).not.toBeNull();
        });

        it('is disabled when isUndoRedoDisabled is true (not redoing)', () => {
            render(
                <WordPressPlaygroundPreview
                    themeZipUrl="/preview/x/wp-theme.zip"
                    onRedo={vi.fn()}
                    isUndoRedoDisabled
                />,
            );
            const btn = screen.getByTitle(/^Redo/);
            expect(btn).toBeDisabled();
        });

        it('is enabled and shows no spinner by default', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" onRedo={vi.fn()} />);
            const btn = screen.getByTitle(/^Redo/);
            expect(btn).not.toBeDisabled();
            expect(btn.querySelector('.animate-spin')).toBeNull();
        });
    });

    describe('Revision History button', () => {
        it('is not rendered when projectId is omitted', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
            expect(screen.queryByTitle('Revision History')).toBeNull();
        });

        it('is rendered when projectId is provided and opens the panel on click', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" projectId="proj-1" />);
            const btn = screen.getByTitle('Revision History');
            expect(btn).toBeInTheDocument();
            expect(screen.queryByTestId('rev-panel-open')).toBeNull();
            fireEvent.click(btn);
            expect(screen.queryByTestId('rev-panel-open')).not.toBeNull();
        });
    });

    describe('Reload button', () => {
        // The Reload control has no `title` attribute (unlike the other toolbar
        // buttons) — it's identified by its visible "Reload" text/accessible
        // name instead.
        it('is always rendered, even with no optional props', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
            expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
        });

        // The Reload button bumps an `attempt` counter that re-triggers the boot
        // effect's `useEffect` dependency array, which re-fetches the theme zip.
        // We assert that side effect (an additional stubbed `fetch` call) rather
        // than asserting an exact call count, since the effect's async chain
        // (fetch -> arrayBuffer -> dynamic import) resolves over several
        // microtask ticks and a strict "+1" assertion risks flaking depending on
        // how many ticks have elapsed by the time we check.
        it('re-triggers the boot fetch when clicked', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('stubbed'));
            vi.stubGlobal('fetch', fetchMock);

            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
            await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1));
            const callsBefore = fetchMock.mock.calls.length;

            fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

            await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
        });
    });

    describe('title-only toolbar buttons get an aria-label', () => {
        it('Undo, Redo, Revision History, and Edit in Site Editor are all reachable by accessible name', () => {
            render(
                <WordPressPlaygroundPreview
                    themeZipUrl="/preview/x/wp-theme.zip"
                    projectId="proj-1"
                    onUndo={vi.fn()}
                    onRedo={vi.fn()}
                />,
            );

            expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Redo' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Revision History' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Edit in Site Editor' })).toBeInTheDocument();
        });
    });

    describe('toolbar overflow', () => {
        it('wraps the button group in a horizontally-scrollable, scrollbar-hidden container', () => {
            render(<WordPressPlaygroundPreview themeZipUrl="/preview/x/wp-theme.zip" />);
            const actions = screen.getByTestId('toolbar-actions');
            expect(actions.className).toContain('overflow-x-auto');
            expect(actions.className).toContain('scrollbar-hide');
        });
    });
});
