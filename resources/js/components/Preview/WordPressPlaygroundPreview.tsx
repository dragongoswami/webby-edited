import { useEffect, useRef, useState } from 'react';
import { AlertCircle, History, LayoutTemplate, Loader2, Redo2, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuildingAnimation } from '@/components/Preview/BuildingAnimation';
import { RevisionHistoryPanel } from '@/components/Preview/RevisionHistoryPanel';
import { useTranslation } from '@/contexts/LanguageContext';

interface WordPressPlaygroundPreviewProps {
    /** Same-origin URL of the generated theme zip (served by PreviewController). */
    themeZipUrl: string;
    /** Enables the revision-history sheet (builder revisions are target-agnostic). */
    projectId?: string;
    /** Bump to force a re-boot (e.g. after a rebuild). */
    refreshKey?: number;
    /** Revision undo/redo (proxied to the builder; rebuild repackages the theme zip). */
    onUndo?: () => void;
    onRedo?: () => void;
    /** Restore a specific revision from the history panel. */
    onRestoreRevision?: (revisionId: number) => Promise<boolean>;
    isUndoing?: boolean;
    isRedoing?: boolean;
    isUndoRedoDisabled?: boolean;
}

// The Playground runtime is loaded at runtime (not bundled) and boots a real
// WordPress (WASM) inside the iframe. We load it through our own subdomain,
// which transparently reverse-proxies the official Playground CDN
// (playground.wordpress.net). The public CDN is 403'd for some networks/regions
// — its service worker fails to register, leaving the preview hung forever at
// "Installing your theme…" — and our server isn't geo-blocked, so proxying it
// fixes that. Loading BOTH the client and the remote from the same origin
// satisfies the Playground client's remote-URL allowlist (it permits the
// client library's own origin).
const PLAYGROUND_ORIGIN = 'https://wordpress.titansys.dev';
const PLAYGROUND_CLIENT = `${PLAYGROUND_ORIGIN}/client/index.js`;
const PLAYGROUND_REMOTE = `${PLAYGROUND_ORIGIN}/remote.html`;
// Stable folder the generated theme installs into, so the Site Editor / preview
// URLs don't depend on the zip's filename.
const THEME_FOLDER = 'webby-preview-theme';

type Phase = 'booting' | 'installing' | 'ready' | 'error';

// Minimal surface of the Playground client this component uses — the full
// client ships untyped from the CDN, so we type just what we call.
interface PlaygroundClient {
    isReady: () => Promise<void>;
    goTo: (path: string) => Promise<void>;
}

interface PlaygroundModule {
    startPlaygroundWeb: (options: Record<string, unknown>) => Promise<PlaygroundClient>;
}

/**
 * Renders a generated WordPress block theme in an in-browser WordPress instance
 * (WordPress Playground). The theme zip is fetched same-origin (carrying the
 * user's session) and installed + activated inside the Playground VFS.
 */
export function WordPressPlaygroundPreview({
    themeZipUrl,
    projectId,
    refreshKey = 0,
    onUndo,
    onRedo,
    onRestoreRevision,
    isUndoing = false,
    isRedoing = false,
    isUndoRedoDisabled = false,
}: WordPressPlaygroundPreviewProps) {
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const clientRef = useRef<PlaygroundClient | null>(null);
    const [phase, setPhase] = useState<Phase>('booting');
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [revisionPanelOpen, setRevisionPanelOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const iframe = iframeRef.current;
        if (!iframe) return;

        setPhase('booting');
        setError(null);

        (async () => {
            try {
                // Fetch the generated theme zip from our OWN origin first so it
                // carries the user's session cookie — the Playground origin
                // (the proxy subdomain) can't authenticate to us, so a Blueprint
                // `url` resource would fail. We hand Playground the in-memory
                // bytes via a `literal` resource instead.
                const res = await fetch(themeZipUrl, { credentials: 'same-origin' });
                if (!res.ok) throw new Error(`theme download failed (${res.status})`);
                const bytes = new Uint8Array(await res.arrayBuffer());
                if (cancelled) return;

                setPhase('installing');

                // Load the Playground client from the CDN (kept out of our bundle).
                const mod = (await import(/* @vite-ignore */ PLAYGROUND_CLIENT)) as PlaygroundModule;
                if (cancelled) return;

                // Boot WordPress and install + activate the theme declaratively
                // via the official `installTheme` Blueprint step — the maintained
                // path (correct folder handling, activation hooks) instead of a
                // hand-rolled ZipArchive + switch_theme.
                const client = await mod.startPlaygroundWeb({
                    iframe,
                    remoteUrl: PLAYGROUND_REMOTE,
                    blueprint: {
                        preferredVersions: { php: '8.3', wp: 'latest' },
                        landingPage: '/',
                        steps: [
                            // The login step authenticates by username alone; the
                            // password field is deprecated in the Blueprint schema.
                            { step: 'login', username: 'admin' },
                            {
                                step: 'installTheme',
                                themeData: {
                                    resource: 'literal',
                                    name: 'theme.zip',
                                    contents: bytes,
                                },
                                options: {
                                    activate: true,
                                    targetFolderName: THEME_FOLDER,
                                },
                            },
                        ],
                    },
                });
                if (cancelled) return;
                clientRef.current = client;

                await client.isReady();
                if (cancelled) return;

                await client.goTo('/');
                if (cancelled) return;
                setPhase('ready');
            } catch (e: unknown) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
                setPhase('error');
            }
        })();

        return () => {
            cancelled = true;
            clientRef.current = null;
        };
    }, [themeZipUrl, refreshKey, attempt]);

    return (
        <div className="h-full w-full flex flex-col bg-background relative overflow-hidden">
            <div className="h-10 px-3 border-b flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-sm z-20">
                <span className="text-xs font-medium text-muted-foreground">
                    {t('WordPress Preview')}
                </span>
                <div data-testid="toolbar-actions" className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {onUndo && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onUndo}
                            disabled={isUndoing || isUndoRedoDisabled}
                            className="h-7 w-7"
                            title={`${t('Undo')} (${navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Z)`}
                            aria-label={t('Undo')}
                        >
                            {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                        </Button>
                    )}
                    {onRedo && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRedo}
                            disabled={isRedoing || isUndoRedoDisabled}
                            className="h-7 w-7"
                            title={`${t('Redo')} (${navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+Z)`}
                            aria-label={t('Redo')}
                        >
                            {isRedoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Redo2 className="h-3.5 w-3.5" />}
                        </Button>
                    )}
                    {projectId && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setRevisionPanelOpen(true)}
                            className="h-7 w-7"
                            title={t('Revision History')}
                            aria-label={t('Revision History')}
                        >
                            <History className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={phase !== 'ready'}
                        onClick={() => clientRef.current?.goTo('/wp-admin/site-editor.php')}
                        className="h-7 w-7"
                        title={t('Edit in Site Editor')}
                        aria-label={t('Edit in Site Editor')}
                    >
                        <LayoutTemplate className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setAttempt((a) => a + 1)}
                        aria-label={t('Reload')}
                    >
                        <RefreshCw className="h-3.5 w-3.5 me-1" />
                        {t('Reload')}
                    </Button>
                </div>
            </div>

            {projectId && (
                <RevisionHistoryPanel
                    open={revisionPanelOpen}
                    onOpenChange={setRevisionPanelOpen}
                    projectId={projectId}
                    refreshTrigger={refreshKey}
                    onRestore={onRestoreRevision}
                />
            )}

            <div className="relative flex-1">
                <iframe
                    ref={iframeRef}
                    title={t('WordPress Preview')}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                    // Playground needs scripts + same-origin to run the WASM runtime.
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />

                {(phase === 'booting' || phase === 'installing') && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-md">
                        <BuildingAnimation
                            t={t}
                            title={phase === 'booting' ? t('Booting WordPress…') : t('Installing your theme…')}
                            subtitle={phase === 'booting'
                                ? t('Starting a real WordPress in your browser')
                                : t('This may take a moment')}
                        />
                    </div>
                )}

                {phase === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/95 z-10 px-6 text-center">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                        <p className="text-sm font-medium">{t('Could not load the WordPress preview')}</p>
                        <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
                        <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                            <RefreshCw className="h-3.5 w-3.5 me-1" />
                            {t('Try again')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
