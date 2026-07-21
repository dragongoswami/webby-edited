/**
 * Tests for RevisionHistoryPanel.
 * Verifies paginated fetch, "Load more" behavior, and the current-badge
 * logic driven by rev.id === currentId.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import { RevisionHistoryPanel } from '../RevisionHistoryPanel';
import { LanguageProvider } from '@/contexts/LanguageContext';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

const makeRev = (id: number) => ({
    id,
    label: `Before v${id}`,
    file_count: 47,
    timestamp: '2026-04-14T02:00:00Z',
});

// LanguageProvider is globally mocked (test/setup.ts) as a passthrough that
// needs no seeding — t() echoes the key with :placeholder substitution.
const renderWithLang = (ui: React.ReactElement) =>
    render(<LanguageProvider>{ui}</LanguageProvider>);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('RevisionHistoryPanel', () => {
    it('fetches initial page with limit=5 when opened', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                revisions: [makeRev(8), makeRev(7), makeRev(6), makeRev(5), makeRev(4)],
                current_id: 8,
                has_more: true,
                oldest_id: 4,
            },
        });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() => expect(mockedAxios.get).toHaveBeenCalled());
        expect(mockedAxios.get).toHaveBeenCalledWith(
            '/builder/projects/abc/revisions',
            { params: { limit: 5 } }
        );

        // All 5 rows render
        await waitFor(() =>
            expect(screen.getByText(/Before v8/)).toBeInTheDocument()
        );
        expect(screen.getByText(/Before v4/)).toBeInTheDocument();
    });

    it('Load more appends older revisions without duplicates', async () => {
        mockedAxios.get
            .mockResolvedValueOnce({
                data: {
                    revisions: [makeRev(8), makeRev(7), makeRev(6), makeRev(5), makeRev(4)],
                    current_id: 8,
                    has_more: true,
                    oldest_id: 4,
                },
            })
            .mockResolvedValueOnce({
                data: {
                    revisions: [makeRev(3), makeRev(2), makeRev(1)],
                    current_id: 8,
                    has_more: false,
                    oldest_id: 1,
                },
            });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() => expect(screen.getByText(/Before v8/)).toBeInTheDocument());

        const loadMore = screen.getByRole('button', { name: /Load more/i });
        fireEvent.click(loadMore);

        await waitFor(() => expect(screen.getByText(/Before v1/)).toBeInTheDocument());

        // Second call used `before` cursor
        expect(mockedAxios.get).toHaveBeenNthCalledWith(
            2,
            '/builder/projects/abc/revisions',
            { params: { limit: 10, before: 4 } }
        );

        // Each label appears exactly once
        for (let id = 1; id <= 8; id++) {
            expect(screen.getAllByText(new RegExp(`Before v${id}`))).toHaveLength(1);
        }
    });

    it('hides Load more when has_more is false', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                revisions: [makeRev(2), makeRev(1)],
                current_id: 2,
                has_more: false,
                oldest_id: 1,
            },
        });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() => expect(screen.getByText(/Before v2/)).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: /Load more/i })).not.toBeInTheDocument();
    });

    it('renders the Current badge on the row whose id matches current_id', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                revisions: [makeRev(3), makeRev(2), makeRev(1)],
                current_id: 2, // middle row
                has_more: false,
                oldest_id: 1,
            },
        });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() => expect(screen.getByText(/Before v2/)).toBeInTheDocument());

        const currentBadges = screen.getAllByText(/^Current$/);
        expect(currentBadges).toHaveLength(1);
        // The badge sits in the same row as the "Before v2" label.
        const badgeRow = currentBadges[0].closest('div.rounded-md');
        expect(badgeRow).not.toBeNull();
        expect(badgeRow!.textContent).toContain('Before v2');
    });

    it('strips synthetic [BRACKET] prefixes from revision labels', async () => {
        // The builder's createSnapshot labels revisions with
        // "Before: <first N chars of user message>" — when the message
        // starts with a synthetic marker like [THEME_APPLY], the label
        // leaks the bracket token. The panel must strip it so users see
        // "Before: Applying Mocha theme" not "Before: [THEME_APPLY] Applying Mocha theme".
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                revisions: [
                    {
                        id: 7,
                        label: 'Before: [THEME_APPLY] Applying Mocha theme',
                        file_count: 47,
                        timestamp: '2026-04-14T02:00:00Z',
                    },
                    {
                        id: 6,
                        label: 'Before: [BATCH_EDIT] Update multiple elements: 1. <h1>',
                        file_count: 47,
                        timestamp: '2026-04-14T02:00:00Z',
                    },
                    {
                        id: 5,
                        label: 'Before: I want to change the hero',
                        file_count: 47,
                        timestamp: '2026-04-14T02:00:00Z',
                    },
                ],
                current_id: 7,
                has_more: false,
                oldest_id: 5,
            },
        });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() =>
            expect(screen.getByText('Before: Applying Mocha theme')).toBeInTheDocument()
        );
        expect(
            screen.getByText('Before: Update multiple elements: 1. <h1>')
        ).toBeInTheDocument();
        // Plain labels pass through untouched.
        expect(screen.getByText('Before: I want to change the hero')).toBeInTheDocument();

        // The raw bracket tokens must NOT appear anywhere in the rendered
        // panel — that's the whole point of this fix.
        expect(screen.queryByText(/\[THEME_APPLY\]/)).not.toBeInTheDocument();
        expect(screen.queryByText(/\[BATCH_EDIT\]/)).not.toBeInTheDocument();
    });

    it('refetches from the beginning when refreshTrigger bumps', async () => {
        mockedAxios.get
            .mockResolvedValueOnce({
                data: {
                    revisions: [makeRev(1)],
                    current_id: 1,
                    has_more: false,
                    oldest_id: 1,
                },
            })
            .mockResolvedValueOnce({
                data: {
                    revisions: [makeRev(2), makeRev(1)],
                    current_id: 2,
                    has_more: false,
                    oldest_id: 1,
                },
            });

        const { rerender } = renderWithLang(
            <RevisionHistoryPanel
                open
                onOpenChange={() => {}}
                projectId="abc"
                refreshTrigger={0}
            />
        );

        await waitFor(() => expect(screen.getByText(/Before v1/)).toBeInTheDocument());

        rerender(
            <LanguageProvider>
                <RevisionHistoryPanel
                    open
                    onOpenChange={() => {}}
                    projectId="abc"
                    refreshTrigger={1}
                />
            </LanguageProvider>
        );

        await waitFor(() => expect(screen.getByText(/Before v2/)).toBeInTheDocument());
        // Second call is the initial-page shape (no `before` cursor).
        expect(mockedAxios.get).toHaveBeenNthCalledWith(
            2,
            '/builder/projects/abc/revisions',
            { params: { limit: 5 } }
        );
    });

    it('renders Restore on non-current rows and forwards the revision id', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                revisions: [makeRev(2), makeRev(1)],
                current_id: 2,
                has_more: false,
                oldest_id: 1,
            },
        });
        const onRestore = vi.fn().mockResolvedValue(true);

        renderWithLang(
            <RevisionHistoryPanel
                open
                onOpenChange={() => {}}
                projectId="abc"
                onRestore={onRestore}
            />
        );

        await waitFor(() => expect(screen.getByText(/Before v2/)).toBeInTheDocument());

        // Exactly one Restore button: the current row (v2) shows the badge
        // instead, only v1 is restorable.
        const restoreButtons = screen.getAllByRole('button', { name: /Restore/i });
        expect(restoreButtons).toHaveLength(1);

        fireEvent.click(restoreButtons[0]);
        await waitFor(() => expect(onRestore).toHaveBeenCalledWith(1));
    });

    it('falls back to a localized "Revision :id" label when the label strips to empty', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                // A label that is ONLY a synthetic marker strips to '' — the
                // row must fall back to the translated "Revision :id" key.
                revisions: [{ id: 7, label: '[STYLE_EDIT]', file_count: 3, timestamp: '2026-04-14T02:00:00Z' }],
                current_id: 7,
                has_more: false,
                oldest_id: 7,
            },
        });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() => expect(screen.getByText('Revision 7')).toBeInTheDocument());
    });

    it('stays read-only when onRestore is not provided', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                revisions: [makeRev(2), makeRev(1)],
                current_id: 2,
                has_more: false,
                oldest_id: 1,
            },
        });

        renderWithLang(
            <RevisionHistoryPanel open onOpenChange={() => {}} projectId="abc" />
        );

        await waitFor(() => expect(screen.getByText(/Before v2/)).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: /Restore/i })).not.toBeInTheDocument();
    });
});
