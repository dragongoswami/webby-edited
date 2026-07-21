import { router, usePage } from '@inertiajs/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getEcho } from '@/hooks/useUserChannel';
import type { BroadcastConfig } from '@/hooks/useBuilderPusher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, AlertTriangle, RotateCw, Download, HelpCircle, ExternalLink, History } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';

export interface BuilderStatus {
    id: number;
    name: string;
    url: string;
    version: string | null;
    drift: boolean;
}

export interface UpdatesSettings {
    current_version: string;
    update_available: boolean;
    latest: string | null;
    changelog: string | null;
    purchase_code_configured: boolean;
    auto_apply: boolean;
    builders: BuilderStatus[];
}

interface UpdateStatus {
    state: string; // idle | preparing | updating | rolling_back | success | failed | failed_rolledback
    phase?: string;
    percent?: number;
    message?: string;
}

// States that mean an update is actively running (used to resume the progress UI after a reload).
const IN_PROGRESS_STATES = ['preparing', 'updating', 'rolling_back'];
const FAILED_STATES = ['failed', 'failed_rolledback'];

type RunState = 'idle' | 'running' | 'success' | 'failed';

export default function UpdatesTab({ settings }: { settings: UpdatesSettings }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [runState, setRunState] = useState<RunState>('idle');
    const [status, setStatus] = useState<UpdateStatus | null>(null);
    const [unreachable, setUnreachable] = useState(false);
    const [stalled, setStalled] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [rollbackOpen, setRollbackOpen] = useState(false);
    const [backups, setBackups] = useState<Array<{ name: string; created: string }>>([]);
    const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
    const [rollingBack, setRollingBack] = useState(false);
    // Tracks the last status signature + how many consecutive polls saw no change,
    // so a genuinely stuck run (process killed mid-prepare, etc.) surfaces a hint
    // instead of an eternally pulsing bar.
    const stallRef = useRef<{ sig: string; count: number }>({ sig: '', count: 0 });
    const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.getAttribute('content') ?? '';

    const page = usePage();
    const broadcastConfig = (page.props.broadcastConfig as BroadcastConfig | null) ?? null;
    const userId = (page.props.auth as { user?: { id?: number } } | undefined)?.user?.id ?? null;

    const failMsg = t('Something went wrong. Please try again.');
    const showError = async (r: Response) => {
        const body = await r.json().catch(() => null);
        toast.error((body && typeof body.error === 'string' && body.error) || failMsg);
    };

    // Poll the apply-status file. A failed fetch (or 503) means the site is in the brief
    // maintenance window mid-swap — that's expected, so we keep polling instead of erroring.
    const poll = useCallback(async () => {
        try {
            const r = await fetch(route('admin.settings.updates.status'), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!r.ok) {
                // 5xx / network blips = the brief maintenance window mid-swap — keep waiting.
                // 403/404 = the endpoint is gone (plugin deactivated) — terminal, stop polling.
                if (r.status === 403 || r.status === 404) {
                    setRunState('failed');
                } else {
                    setUnreachable(true);
                }
                return;
            }
            const d: UpdateStatus = await r.json();
            if (!d || typeof d.state !== 'string') {
                // Mid-write / malformed payload — treat as "still applying", keep waiting.
                setUnreachable(true);
                return;
            }
            setUnreachable(false);
            setStatus(d);

            // Stall detection: if the status hasn't changed for many consecutive polls
            // while still "in progress", flag it so the UI stops implying healthy progress.
            // (~3s interval × 100 polls ≈ 5 minutes — well beyond a normal update.)
            const sig = `${d.state}|${d.percent ?? ''}|${d.message ?? ''}`;
            if (sig !== stallRef.current.sig) {
                stallRef.current = { sig, count: 0 };
                setStalled(false);
            } else if (IN_PROGRESS_STATES.includes(d.state)) {
                stallRef.current.count += 1;
                if (stallRef.current.count >= 100) setStalled(true);
            }

            if (d.state === 'success') {
                setRunState('success');
            } else if (FAILED_STATES.includes(d.state)) {
                setRunState('failed');
            }
        } catch {
            // Site briefly unavailable while files are swapped — keep waiting.
            setUnreachable(true);
        }
    }, []);

    // On mount, detect an update that's already running (e.g. the admin reloaded mid-update)
    // and resume the progress UI instead of showing nothing.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const r = await fetch(route('admin.settings.updates.status'), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                if (!r.ok || !active) return;
                const d: UpdateStatus = await r.json();
                if (active && IN_PROGRESS_STATES.includes(d.state)) {
                    setStatus(d);
                    setRunState('running');
                }
            } catch {
                // ignore on mount
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    // While an update is running, poll for progress every few seconds. This is the
    // fallback that also covers the detached-runner phase (file swap / migrate), which
    // writes status.json but cannot broadcast (the site is in maintenance mode).
    useEffect(() => {
        if (runState !== 'running') return;
        const id = window.setInterval(poll, 3000);
        return () => window.clearInterval(id);
    }, [runState, poll]);

    // Realtime progress over the existing Reverb/Pusher user channel. ApplyUpdateJob
    // broadcasts `.update.progress` during the prepare phases (download → backup),
    // so the page reflects them instantly instead of waiting for the next poll.
    useEffect(() => {
        if (!broadcastConfig || !userId) return;
        let channel: ReturnType<ReturnType<typeof getEcho>['private']> | null = null;
        try {
            channel = getEcho(broadcastConfig).private(`App.Models.User.${userId}`);
            channel.listen('.update.progress', (d: UpdateStatus) => {
                if (!d || typeof d.state !== 'string') return;
                setUnreachable(false);
                setStatus(d);
                if (d.state === 'success') setRunState('success');
                else if (FAILED_STATES.includes(d.state)) setRunState('failed');
                else setRunState('running');
            });
        } catch {
            // Realtime is best-effort; polling remains the fallback.
        }
        return () => {
            try {
                channel?.stopListening('.update.progress');
            } catch {
                /* noop */
            }
        };
    }, [broadcastConfig, userId]);

    const check = () => {
        setBusy(true);
        fetch(route('admin.settings.updates.check'), { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrfToken } })
            .then(async (r) => {
                if (!r.ok) {
                    await showError(r);
                    return;
                }
                router.reload({ only: ['settings'] });
            })
            .catch(() => toast.error(failMsg))
            .finally(() => setBusy(false));
    };

    const pullFromGithub = () => {
        if (!confirm(t('This will pull the latest code from GitHub, create a backup, and rebuild. Continue?'))) {
            return;
        }
        setBusy(true);
        enterRunning();
        fetch(route('admin.settings.updates.pull'), { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrfToken } })
            .then(async (r) => {
                if (!r.ok) {
                    setRunState('idle');
                    await showError(r);
                    return;
                }
                const d = await r.json().catch(() => ({}));
                if (d.started) {
                    toast.success(t('GitHub pull started'));
                }
            })
            .catch(() => {
                setRunState('idle');
                toast.error(failMsg);
            })
            .finally(() => setBusy(false));
    };

    const enterRunning = () => {
        stallRef.current = { sig: '', count: 0 };
        setStalled(false);
        setUnreachable(false);
        setStatus({ state: 'preparing', percent: 5, message: t('Starting the update…') });
        setRunState('running');
    };

    const apply = () => {
        setConfirmOpen(false);
        setBusy(true);
        fetch(route('admin.settings.updates.apply'), { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrfToken } })
            .then(async (r) => {
                // A 4xx is an immediate, terminal rejection (e.g. 422 no update, 403 not
                // entitled): nothing is running, so show the error and stop.
                if (r.status >= 400 && r.status < 500) {
                    await showError(r);
                    return;
                }
                const d = await r.json().catch(() => ({}));
                if (r.ok && d.started) {
                    toast.success(t('Update started'));
                }
                // For a successful start OR a 5xx, enter the progress UI and let
                // polling/broadcast report the real outcome — the job now writes a
                // 'failed' status on a prepare-phase error, and under sync the request
                // can even time out while the job is still in flight.
                enterRunning();
            })
            .catch(() => {
                // Network error / gateway timeout (common under sync, where the apply
                // request blocks through download+backup). The update may still be
                // running, so enter the progress UI and poll for the outcome.
                enterRunning();
            })
            .finally(() => setBusy(false));
    };

    const updateBuilder = (builderId?: number) => {
        setBusy(true);
        fetch(route('admin.settings.updates.builder'), {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(builderId ? { builder_id: builderId } : {}),
        })
            .then(async (r) => {
                if (!r.ok) {
                    await showError(r);
                    return;
                }
                toast.success(t('Builder update triggered'));
                router.reload({ only: ['settings'] });
            })
            .catch(() => toast.error(failMsg))
            .finally(() => setBusy(false));
    };

    const openRollbackModal = async () => {
        try {
            const r = await fetch(route('admin.rollback.index'), { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (r.ok) {
                const d = await r.json();
                setBackups(d.backups || []);
            }
        } catch {
            setBackups([]);
        }
        setRollbackOpen(true);
    };

    const executeRollback = () => {
        if (!selectedBackup) return;
        setRollingBack(true);
        fetch(route('admin.rollback.execute'), {
            method: 'POST',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrfToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ backup: selectedBackup }),
        })
            .then(async (r) => {
                if (!r.ok) {
                    const d = await r.json().catch(() => ({}));
                    toast.error(d.message || failMsg);
                    return;
                }
                setRollbackOpen(false);
                toast.success(t('Rollback started'));
                enterRunning();
            })
            .catch(() => toast.error(failMsg))
            .finally(() => setRollingBack(false));
    };

    if (runState !== 'idle') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('Updates')}</CardTitle>
                    <CardDescription>{t('Check for and apply new releases.')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {runState === 'running' && (
                        <>
                            <Alert variant="warning">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('Update in progress')}</AlertTitle>
                                <AlertDescription>
                                    {t('Keep this page open. Your site will be briefly unavailable while the update installs — please don’t reload or close this tab. A full backup was taken first, so a failure rolls back automatically.')}
                                </AlertDescription>
                            </Alert>
                            <div className="space-y-2">
                                {(() => {
                                    // Only the runner's "updating" phase reports a meaningful percentage.
                                    // The "preparing" phase (download/backup) has no granular progress, so we
                                    // show an indeterminate (pulsing) bar instead of a misleading frozen number.
                                    const determinate = status?.state === 'updating' && typeof status?.percent === 'number';
                                    return (
                                        <>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {status?.message || t('Updating…')}
                                                </span>
                                                {determinate && <span className="text-muted-foreground">{status?.percent}%</span>}
                                            </div>
                                            <Progress
                                                value={determinate ? status?.percent : status?.percent ?? 5}
                                                className={determinate ? undefined : 'animate-pulse'}
                                            />
                                        </>
                                    );
                                })()}
                                {unreachable && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('Your site is temporarily offline while files are swapped. This page will update on its own once it’s back — there’s no need to do anything.')}
                                    </p>
                                )}
                                {stalled && !unreachable && (
                                    <p className="text-xs text-warning">
                                        {t('This is taking longer than expected and may have stalled. If it doesn’t progress, check storage/logs/laravel.log on your server for the cause.')}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                    {runState === 'success' && (
                        <>
                            <Alert variant="success">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>{t('Update complete')}</AlertTitle>
                                <AlertDescription>
                                    {status?.message || t('Your site has been updated successfully.')}
                                </AlertDescription>
                            </Alert>
                            <Button onClick={() => window.location.reload()}>
                                <RotateCw className="h-4 w-4" />
                                {t('Reload page')}
                            </Button>
                        </>
                    )}
                    {runState === 'failed' && (
                        <>
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>{t('Update failed')}</AlertTitle>
                                <AlertDescription>
                                    {(status?.message || t('The update could not be completed.')) +
                                        // The runner rolls back after a failed swap ('failed_rolledback');
                                        // a prepare-phase failure ('failed') never touched your files.
                                        (status?.state === 'failed_rolledback'
                                            ? ' ' + t('Your previous version was restored from the automatic backup.')
                                            : ' ' + t('No changes were applied, so your site is unchanged.'))}
                                </AlertDescription>
                            </Alert>
                            <Button variant="outline" onClick={() => window.location.reload()}>
                                <RotateCw className="h-4 w-4" />
                                {t('Reload page')}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('Updates')}</CardTitle>
                <CardDescription>{t('Check for and apply new releases.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {settings.update_available ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">{settings.current_version}</Badge>
                            <span>→</span>
                            <Badge>{settings.latest}</Badge>
                        </div>
                        {settings.changelog && <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{settings.changelog}</pre>}
                        <p className="text-xs text-muted-foreground">{t('A full backup (files + database) is taken automatically before applying.')}</p>
                        <Button onClick={() => setConfirmOpen(true)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('Update now')}</Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        {t("You're up to date")} — {settings.current_version}
                    </div>
                )}
                {settings.builders.length > 0 && (
                    <div className="space-y-2 border-t pt-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{t('Builders')}</p>
                            {settings.builders.some((b) => b.drift) && (
                                <Button variant="outline" size="sm" onClick={() => updateBuilder()} disabled={busy}>{t('Update all')}</Button>
                            )}
                        </div>
                        <ul className="space-y-2">
                            {settings.builders.map((b) => (
                                <li key={b.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{b.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{b.url}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {b.version === null ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                                                {t('Offline')}
                                            </span>
                                        ) : b.drift ? (
                                            <>
                                                <Badge variant="outline" className="text-xs">{t('Outdated')} · v{b.version}</Badge>
                                                <Button size="sm" onClick={() => updateBuilder(b.id)} disabled={busy}>{t('Update')}</Button>
                                            </>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                                v{b.version}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className="flex items-center gap-2 border-t pt-4">
                    <Button variant="outline" onClick={check} disabled={busy}>{t('Check now')}</Button>
                    <Button variant="outline" onClick={pullFromGithub} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {t('Pull from GitHub')}
                    </Button>
                    <Button variant="outline" onClick={openRollbackModal} disabled={busy}>
                        <History className="h-4 w-4" />
                        {t('Rollback')}
                    </Button>
                    <div className="flex-1" />
                    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <HelpCircle className="h-4 w-4" />
                                {t('Setup Guide')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{t('Pull from GitHub - Setup Guide')}</DialogTitle>
                                <DialogDescription>
                                    {t('Follow these steps to enable pulling code from GitHub')}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 text-sm">
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('Step 1: SSH into your server')}</h3>
                                    <code className="block bg-muted p-2 rounded text-xs">ssh user@your-server.com</code>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('Step 2: Navigate to Webby')}</h3>
                                    <code className="block bg-muted p-2 rounded text-xs">cd /home/webby/Install</code>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('Step 3: Initialize Git (if not already)')}</h3>
                                    <code className="block bg-muted p-2 rounded text-xs">git init && git remote add origin https://github.com/YOUR_USERNAME/webby.git</code>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('Step 4: Create required directories')}</h3>
                                    <code className="block bg-muted p-2 rounded text-xs">mkdir -p storage/app/updates storage/app/logs storage/app/backups && chmod -R 775 storage</code>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('Step 5: Test the connection')}</h3>
                                    <code className="block bg-muted p-2 rounded text-xs">git fetch origin main</code>
                                </div>

                                <Alert variant="default" className="bg-blue-50 border-blue-200">
                                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                                    <AlertTitle className="text-blue-800">{t('Important Notes')}</AlertTitle>
                                    <AlertDescription className="text-blue-700 text-xs space-y-1">
                                        <p>• {t("For private repos, use:")} <code>git remote add origin https://TOKEN@github.com/user/repo.git</code></p>
                                        <p>• {t('Backups are stored in')} <code>storage/app/backups/</code></p>
                                        <p>• {t('Logs are in')} <code>storage/app/logs/pull_update.log</code></p>
                                        <p>• {t('Update status is in')} <code>storage/app/updates/status.json</code></p>
                                    </AlertDescription>
                                </Alert>

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('How to Use')}</h3>
                                    <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                                        <li>{t('Push your code to GitHub on your computer')}</li>
                                        <li>{t('Click "Pull from GitHub" button here')}</li>
                                        <li>{t('Watch the progress - site will be briefly unavailable')}</li>
                                        <li>{t('Done! Your live site is updated')}</li>
                                    </ol>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="font-semibold text-foreground">{t('Safety Features')}</h3>
                                    <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                        <li>{t('Automatic backup before any changes')}</li>
                                        <li>{t('Automatic rollback if anything fails')}</li>
                                        <li>{t('Maintenance mode during update')}</li>
                                        <li>{t('Keep last 3 backups')}</li>
                                    </ul>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={() => window.open('/help/pull-from-github', '_blank')}>
                                        <ExternalLink className="h-3 w-3" />
                                        {t('Open Full Documentation')}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Start the update now?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('Your site will be briefly unavailable while the update installs. A full backup (files + database) is taken first, so a failure rolls back automatically.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={apply} disabled={busy}>{t('Update now')}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rollback Dialog */}
            <Dialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Rollback to Previous Backup')}</DialogTitle>
                        <DialogDescription>
                            {t('Select a backup to restore. This will replace current files and database.')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {backups.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                {t('No backups available')}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {backups.map((backup, index) => (
                                    <div
                                        key={backup.name}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                            selectedBackup === backup.name
                                                ? 'border-primary bg-primary/5'
                                                : 'hover:bg-muted/50'
                                        }`}
                                        onClick={() => setSelectedBackup(backup.name)}
                                    >
                                        <input
                                            type="radio"
                                            name="backup"
                                            checked={selectedBackup === backup.name}
                                            onChange={() => setSelectedBackup(backup.name)}
                                            className="h-4 w-4"
                                        />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{backup.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {backup.created}
                                                {index === 0 && <span className="ml-2 text-primary">({t('Latest')})</span>}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Alert variant="destructive" className="py-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                {t('This will restore files, database, and all remote builders from the selected backup.')}
                            </AlertDescription>
                        </Alert>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRollbackOpen(false)} disabled={rollingBack}>
                            {t('Cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={executeRollback}
                            disabled={!selectedBackup || rollingBack}
                        >
                            {rollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                            {t('Rollback')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
