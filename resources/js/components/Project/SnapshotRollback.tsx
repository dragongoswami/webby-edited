import { useEffect, useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { History, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface Snapshot {
    id: number;
    label: string;
    file_count: number;
    size: string;
    size_bytes: number;
    created_at: string;
}

interface SnapshotRollbackProps {
    projectId: string;
}

export function SnapshotRollback({ projectId }: SnapshotRollbackProps) {
    const { t } = useTranslation();
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [rollingBack, setRollingBack] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);

    const fetchSnapshots = useCallback(async () => {
        try {
            const res = await axios.get(`/builder/projects/${projectId}/snapshots`);
            setSnapshots(res.data.snapshots || []);
        } catch {
            // Silently fail — snapshots are optional
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        fetchSnapshots();
    }, [fetchSnapshots]);

    const handleRollback = async (snapshotId: number) => {
        setRollingBack(snapshotId);
        try {
            await axios.post(`/builder/projects/${projectId}/snapshots/${snapshotId}/rollback`);
            toast.success(t('Rolled back successfully'));
            router.reload();
        } catch {
            toast.error(t('Rollback failed'));
        } finally {
            setRollingBack(null);
        }
    };

    const handleDelete = async (snapshotId: number) => {
        setDeleting(snapshotId);
        try {
            await axios.delete(`/builder/projects/${projectId}/snapshots/${snapshotId}`);
            setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
        } catch {
            toast.error(t('Delete failed'));
        } finally {
            setDeleting(null);
        }
    };

    const formatRelativeTime = (isoString: string) => {
        const date = new Date(isoString);
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

    if (loading || snapshots.length === 0) {
        return null;
    }

    return (
        <div className="border-t pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">{t('Previous Versions')}</h4>
            </div>

            {/* Snapshots restore the BUILT preview, not the project source —
                a later build regenerates from the current source. Make that
                limit explicit so a rollback isn't mistaken for a code undo. */}
            <p className="text-xs text-muted-foreground mb-3">
                {t('Restores the published preview only. Your next build will regenerate it from the current project source — use Undo in the editor to revert code changes.')}
            </p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
                {snapshots.map(snapshot => (
                    <div key={snapshot.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm">
                        <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{snapshot.label}</p>
                            <p className="text-xs text-muted-foreground">
                                {t(':count files · :size', { count: snapshot.file_count, size: snapshot.size })} &middot; {formatRelativeTime(snapshot.created_at)}
                            </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={rollingBack !== null}>
                                        {rollingBack === snapshot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                        <span className="ms-1">{t('Rollback')}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('Rollback to this version?')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t('This will restore your project preview to this snapshot. Your current preview will be replaced.')}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRollback(snapshot.id)}>
                                            {t('Rollback')}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={deleting !== null}>
                                        {deleting === snapshot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-muted-foreground" />}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('Delete this snapshot?')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t('This action cannot be undone.')}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(snapshot.id)}>
                                            {t('Delete')}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
