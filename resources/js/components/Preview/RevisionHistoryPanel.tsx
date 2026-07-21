import { useEffect, useState, useCallback, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import { Clock, FileCode2, Loader2, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { stripSyntheticPrefix } from '@/components/Chat/SyntheticEventBubble';

interface Revision {
    id: number;
    label: string;
    file_count: number;
    timestamp: string;
}

interface RevisionsResponse {
    revisions: Revision[];
    // `current` is the legacy array-index pointer; keep for fallback only.
    current?: number;
    // `current_id` is the preferred field — the revision id at the pointer.
    // Works under any slicing/order, which `current` does not.
    current_id?: number;
    has_more?: boolean;
    oldest_id?: number;
}

interface RevisionHistoryPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    refreshTrigger?: number;
    /**
     * Restore the workspace to a revision. Resolves true when the restore
     * applied (the parent bumps refreshTrigger, which refetches this list).
     * Omit to render the panel read-only.
     */
    onRestore?: (revisionId: number) => Promise<boolean>;
}

// Initial and "Load more" batch sizes. Small initial batch keeps the panel
// snappy on first open; larger subsequent batch means users rarely need more
// than one click to see the full history at the 20-revision cap.
const INITIAL_LIMIT = 5;
const LOAD_MORE_LIMIT = 10;

export function RevisionHistoryPanel({ open, onOpenChange, projectId, refreshTrigger, onRestore }: RevisionHistoryPanelProps) {
    const { t } = useTranslation();
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [currentId, setCurrentId] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [oldestId, setOldestId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [restoringId, setRestoringId] = useState<number | null>(null);
    // Synchronous re-entry guard for fetchMore. The loadingMore state is the
    // user-facing spinner; this ref blocks a second in-flight request even
    // when React hasn't committed the state update from the first click yet
    // (e.g., double-click within the same paint tick).
    const fetchingMoreRef = useRef(false);

    const fetchInitial = useCallback(async () => {
        setLoading(true);
        setError(false);
        // Reset pagination state at the start of every refetch so a failed
        // request can't leave the list showing a mix of stale rows and a
        // stale `oldestId` cursor (which would cause the next "Load more"
        // to page from the wrong point).
        setRevisions([]);
        setOldestId(null);
        setHasMore(false);
        try {
            const res = await axios.get<RevisionsResponse>(
                `/builder/projects/${projectId}/revisions`,
                { params: { limit: INITIAL_LIMIT } }
            );
            const rows = res.data.revisions || [];
            setRevisions(rows);
            // Prefer current_id (new field). Fall back to legacy `current` +
            // array index resolution if the builder hasn't been upgraded.
            if (typeof res.data.current_id === 'number') {
                setCurrentId(res.data.current_id);
            } else if (typeof res.data.current === 'number' && rows[res.data.current]) {
                setCurrentId(rows[res.data.current].id);
            } else {
                setCurrentId(0);
            }
            setHasMore(res.data.has_more ?? false);
            setOldestId(res.data.oldest_id ?? (rows.length > 0 ? rows[rows.length - 1].id : null));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const fetchMore = useCallback(async () => {
        if (fetchingMoreRef.current || !hasMore || oldestId === null) return;
        fetchingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const res = await axios.get<RevisionsResponse>(
                `/builder/projects/${projectId}/revisions`,
                { params: { limit: LOAD_MORE_LIMIT, before: oldestId } }
            );
            const rows = res.data.revisions || [];
            // Guard against the builder returning overlapping ids (shouldn't
            // happen — `before` is exclusive — but cheap insurance).
            setRevisions((prev) => {
                const seen = new Set(prev.map((r) => r.id));
                return [...prev, ...rows.filter((r) => !seen.has(r.id))];
            });
            setHasMore(res.data.has_more ?? false);
            if (rows.length > 0) {
                setOldestId(res.data.oldest_id ?? rows[rows.length - 1].id);
            }
        } catch {
            // Silent — keep the existing rows, let the user retry.
        } finally {
            fetchingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [projectId, oldestId, hasMore]);

    useEffect(() => {
        if (open) {
            fetchInitial();
        }
    }, [open, refreshTrigger, fetchInitial]);

    const handleRestore = useCallback(async (revisionId: number) => {
        if (!onRestore || restoringId !== null) return;
        setRestoringId(revisionId);
        try {
            // On success the parent bumps refreshTrigger (rebuild + preview
            // reload), which refetches this list with the new pointer.
            await onRestore(revisionId);
        } finally {
            setRestoringId(null);
        }
    }, [onRestore, restoringId]);

    const formatRelativeTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return t('Just now');
        if (diffMin < 60) return t(':count m ago', { count: diffMin });
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return t(':count h ago', { count: diffHours });
        const diffDays = Math.floor(diffHours / 24);
        return t(':count d ago', { count: diffDays });
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-80 sm:w-96">
                <SheetHeader>
                    <SheetTitle>{t('Revision History')}</SheetTitle>
                    <SheetDescription>
                        {revisions.length > 0
                            ? t(':count revisions', { count: revisions.length })
                            : t('No revisions yet')}
                    </SheetDescription>
                </SheetHeader>

                <div className="px-4 pb-4 mt-2 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-10rem)]">
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!loading && error && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {t('Something went wrong. Please try again.')}
                        </p>
                    )}

                    {!loading && !error && revisions.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {t('No revisions yet')}
                        </p>
                    )}

                    {!loading && !error && revisions.map((rev) => {
                        const isCurrent = rev.id === currentId;
                        return (
                            <div
                                key={rev.id}
                                className={`px-4 py-3 rounded-md border transition-colors ${
                                    isCurrent
                                        ? 'bg-primary/5 border-primary/20'
                                        : 'border-border/60 hover:bg-muted/50'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate leading-snug">
                                            {/* Strip any [THEME_APPLY]/[STYLE_EDIT]/[AI_EDIT]/[BATCH_EDIT]
                                                markers the builder baked into the label so users see
                                                "Before: Applying Mocha theme" instead of
                                                "Before: [THEME_APPLY] Applying Mocha theme". */}
                                            {stripSyntheticPrefix(rev.label) || t('Revision :id', { id: rev.id })}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <FileCode2 className="h-3 w-3" />
                                                {t(':count files', { count: rev.file_count })}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatRelativeTime(rev.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                    {isCurrent ? (
                                        <span className="shrink-0 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                            {t('Current')}
                                        </span>
                                    ) : onRestore ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="shrink-0 h-6 px-2 text-xs"
                                            disabled={restoringId !== null}
                                            onClick={() => handleRestore(rev.id)}
                                            title={t('Restore this version')}
                                        >
                                            {restoringId === rev.id ? (
                                                <Loader2 className="h-3 w-3 me-1 animate-spin" />
                                            ) : (
                                                <RotateCcw className="h-3 w-3 me-1" />
                                            )}
                                            {t('Restore')}
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}

                    {!loading && !error && hasMore && (
                        <div className="pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                disabled={loadingMore}
                                onClick={fetchMore}
                            >
                                {loadingMore && <Loader2 className="h-3 w-3 me-2 animate-spin" />}
                                {loadingMore ? t('Loading older revisions…') : t('Load more')}
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
