import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { ElementToolbar } from './ElementToolbar';
import { StylePanel } from './StylePanel/StylePanel';
import { PendingEditsPanel } from './PendingEditsPanel';
import { usePreviewInspector } from '@/hooks/usePreviewInspector';
import { usePreviewThemeSync } from '@/hooks/usePreviewThemeSync';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { DeviceWidthToggle, DEVICE_WIDTHS, type PreviewDevice } from './DeviceWidthToggle';
import { cn } from '@/lib/utils';
import { MousePointerClick, Loader2, Palette, Undo2, Redo2, History, X } from 'lucide-react';
import { BuildingAnimation } from '@/components/Preview/BuildingAnimation';
import { toast } from 'sonner';
import type { InspectorElement, ElementMention, PendingEdit } from '@/types/inspector';
import { formatStyleEditMessage } from '@/lib/style-save';
import confetti from 'canvas-confetti';
import { useThumbnailCapture } from '@/hooks/useThumbnailCapture';
import { RevisionHistoryPanel } from './RevisionHistoryPanel';
import { ImageSwapPanel } from './ImageSwapPanel';

type PreviewMode = 'preview' | 'inspect' | 'design';

interface InspectPreviewProps {
    previewUrl?: string | null;
    refreshTrigger?: number;
    isBuilding?: boolean;
    mode?: PreviewMode;
    onModeChange?: (mode: PreviewMode) => void;
    projectId?: string;  // For thumbnail capture
    captureThumbnailTrigger?: number;  // Change this value to trigger thumbnail capture
    // Inspect mode callbacks (optional when mode !== 'inspect')
    onElementSelect?: (element: ElementMention) => void;
    onElementEdit?: (edit: PendingEdit) => void;
    pendingEdits?: PendingEdit[];
    onSaveAllEdits?: () => Promise<void>;
    onDiscardAllEdits?: () => void;
    onRemoveEdit?: (id: string) => void;
    // Design mode props
    themeDesignerSlot?: React.ReactNode;
    isSavingTheme?: boolean;
    onSendStyleEdit?: (message: string) => void;
    /** Deterministic class edit; resolves true when applied without the AI. */
    onApplyStyleClasses?: (payload: { oldClassName: string; newClassName: string; textAnchor: string }) => Promise<boolean>;
    // Undo/Redo
    onUndo?: () => void;
    onRedo?: () => void;
    /** Restore a specific revision from the history panel. */
    onRestoreRevision?: (revisionId: number) => Promise<boolean>;
    isUndoing?: boolean;
    isRedoing?: boolean;
    isUndoRedoDisabled?: boolean;
    // Storage props for image swap
    storageEnabled?: boolean;
    maxFileSizeMb?: number;
    /** Tailors the pre-build empty-state copy ("website" vs "theme"). */
    outputTarget?: 'website' | 'wordpress_theme';
}

/**
 * Preview component with element inspection capabilities.
 * Allows users to click elements and mention them in chat or edit inline.
 */
export function InspectPreview({
    previewUrl,
    outputTarget = 'website',
    refreshTrigger = 0,
    isBuilding = false,
    mode = 'preview',
    onModeChange,
    projectId,
    captureThumbnailTrigger,
    onElementSelect,
    onElementEdit,
    pendingEdits = [],
    onSaveAllEdits,
    onDiscardAllEdits,
    onRemoveEdit,
    themeDesignerSlot,
    isSavingTheme = false,
    onSendStyleEdit,
    onApplyStyleClasses,
    onUndo,
    onRedo,
    onRestoreRevision,
    isUndoing = false,
    isRedoing = false,
    isUndoRedoDisabled = false,
    storageEnabled = false,
    maxFileSizeMb = 5,
}: InspectPreviewProps) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const wasBuilding = useRef(false);
    // Once canvas-confetti.create() is called with `useWorker: true`, the canvas
    // is transferred to a worker via transferControlToOffscreen() and the main
    // thread can no longer set canvas.width/height. This ref guards the manual
    // ResizeObserver-driven resize so we don't trigger an OffscreenCanvas warning.
    const confettiInitialized = useRef(false);
    const [isSaving, setIsSaving] = useState(false);
    const [iframeReady, setIframeReady] = useState(false);
    const [revisionPanelOpen, setRevisionPanelOpen] = useState(false);
    const [imagePanelOpen, setImagePanelOpen] = useState(false);
    const [imageElement, setImageElement] = useState<InspectorElement | null>(null);
    const [device, setDevice] = useState<PreviewDevice>('full');

    // Use the preview inspector hook - only enabled in inspect mode
    const {
        contextMenu,
        closeContextMenu,
        isReady,
        startEditingElement,
        revertEdits,
        // Style panel
        stylePanelOpen,
        styleElement,
        styleClasses,
        originalClasses,
        openStylePanel,
        closeStylePanel,
        updateStyleClasses,
        resetStyleClasses,
    } = usePreviewInspector({
        iframeRef,
        enabled: mode === 'inspect' && !isBuilding,
        onElementSelect: mode === 'inspect' && onElementSelect ? (element) => {
            const mention: ElementMention = {
                id: element.id,
                tagName: element.tagName,
                selector: element.cssSelector,
                textPreview: element.textPreview,
            };
            onElementSelect(mention);
        } : undefined,
        onElementEdit: mode === 'inspect' ? onElementEdit : undefined,
    });

    // Track iframe load state independently of inspector mode
    useEffect(() => {
        setIframeReady(false);
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => setIframeReady(true);
        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
    }, [refreshTrigger]);

    // Sync light/dark theme with iframe (works in all modes)
    usePreviewThemeSync({ iframeRef, isReady: iframeReady || isReady });

    // Thumbnail capture hook
    const { captureAndUpload } = useThumbnailCapture(iframeRef, projectId);

    // Resize canvas to match container — but only until canvas-confetti takes
    // ownership. After confetti.create({ useWorker: true }) calls
    // transferControlToOffscreen(), the main thread can no longer set
    // canvas.width/height (it produces a console warning). canvas-confetti has
    // its own internal resize handling for the offscreen path via the
    // `resize: true` option, so we just need to stop competing with it.
    useEffect(() => {
        const updateCanvasSize = () => {
            if (confettiInitialized.current) return;
            if (canvasRef.current && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = rect.width;
                canvasRef.current.height = rect.height;
            }
        };

        updateCanvasSize();

        const resizeObserver = new ResizeObserver(updateCanvasSize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    // Confetti effect and thumbnail capture when build completes
    useEffect(() => {
        if (wasBuilding.current && !isBuilding && canvasRef.current) {
            const myConfetti = confetti.create(canvasRef.current, {
                resize: true,
                useWorker: true,
            });
            // Once confetti owns the canvas via transferControlToOffscreen(),
            // the main-thread ResizeObserver above must stop touching
            // canvas.width/height. See the resize effect for the gate.
            confettiInitialized.current = true;

            const duration = 2500;
            const end = Date.now() + duration;

            const frame = () => {
                myConfetti({
                    particleCount: 4,
                    angle: 60,
                    spread: 70,
                    origin: { x: 0, y: 0.6 },
                    colors: ['#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444'],
                });
                myConfetti({
                    particleCount: 4,
                    angle: 120,
                    spread: 70,
                    origin: { x: 1, y: 0.6 },
                    colors: ['#a855f7', '#3b82f6', '#22c55e', '#eab308', '#ef4444'],
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();

            // Capture thumbnail after iframe has fully rendered (fire-and-forget)
            // 2s delay to allow external resources (fonts, images) to load
            setTimeout(() => {
                captureAndUpload();
            }, 2000);
        }
        wasBuilding.current = isBuilding;
    }, [isBuilding, captureAndUpload]);

    // Capture thumbnail when trigger prop changes (e.g., after theme apply)
    const lastCaptureTrigger = useRef(0);
    useEffect(() => {
        if (captureThumbnailTrigger && captureThumbnailTrigger > 0 && captureThumbnailTrigger !== lastCaptureTrigger.current) {
            lastCaptureTrigger.current = captureThumbnailTrigger;
            // 2s delay to allow preview to update with new theme
            setTimeout(() => {
                captureAndUpload();
            }, 2000);
        }
    }, [captureThumbnailTrigger, captureAndUpload]);

    // Handle edit from context menu
    const handleEdit = useCallback((element: InspectorElement) => {
        closeContextMenu();
        startEditingElement(element.cssSelector);
    }, [closeContextMenu, startEditingElement]);

    // Handle opening style panel from toolbar
    const handleOpenStyle = useCallback((element: InspectorElement) => {
        closeContextMenu();
        openStylePanel(element);
    }, [closeContextMenu, openStylePanel]);

    // Handle AI edit from toolbar
    const handleAiEdit = useCallback((element: InspectorElement) => {
        closeContextMenu();
        const pendingText = pendingEdits.find(
            e => e.element.cssSelector === element.cssSelector && e.field === 'text'
        )?.newValue;
        const text = (pendingText ?? element.textPreview).replace(/"/g, '\\"');
        const description = `<${element.tagName}${element.classNames[0] ? '.' + element.classNames[0] : ''}>`;
        onSendStyleEdit?.(`[AI_EDIT] Improve the styling of ${description}: "${text}"`);
    }, [closeContextMenu, onSendStyleEdit, pendingEdits]);

    // Handle style panel apply. Try a deterministic, instant class edit first
    // (the builder locates the element by its unique className + text anchor and
    // rewrites the source directly); only fall back to the AI style-edit session
    // when the element can't be uniquely located (dynamic/duplicated classes).
    const handleStyleApply = useCallback(async () => {
        if (!styleElement) return;
        // Both the deterministic and the AI paths no-op while a build is running;
        // tell the user instead of silently dropping the change.
        if (isBuilding) {
            toast.warning(t('A build is already running. Please wait.'));
            return;
        }
        closeStylePanel();

        const applied = await onApplyStyleClasses?.({
            oldClassName: originalClasses.join(' '),
            newClassName: styleClasses.join(' '),
            textAnchor: styleElement.textPreview,
        });
        if (applied) {
            toast.success(t('Style applied'));
            return;
        }

        const description = `<${styleElement.tagName}${styleElement.classNames[0] ? '.' + styleElement.classNames[0] : ''}>`;
        const msg = formatStyleEditMessage(description, originalClasses, styleClasses);
        onSendStyleEdit?.(msg);
        toast.success(t('Style changes sent to AI'));
    }, [styleElement, isBuilding, originalClasses, styleClasses, onApplyStyleClasses, onSendStyleEdit, closeStylePanel, t]);

    // Compute adjusted element with page-relative bounding rect for toolbar positioning
    const adjustedContextElement = useMemo(() => {
        if (!contextMenu?.element || !iframeRef.current) return null;
        const iframeRect = iframeRef.current.getBoundingClientRect();
        return {
            ...contextMenu.element,
            boundingRect: {
                top: contextMenu.element.boundingRect.top + iframeRect.top,
                left: contextMenu.element.boundingRect.left + iframeRect.left,
                width: contextMenu.element.boundingRect.width,
                height: contextMenu.element.boundingRect.height,
            },
        };
    }, [contextMenu?.element, iframeRef]);

    // Handle save all edits
    const handleSaveAll = useCallback(async () => {
        if (!onSaveAllEdits) return;
        setIsSaving(true);
        try {
            await onSaveAllEdits();
            toast.success(t('Changes sent to AI for processing'));
        } catch {
            toast.error(t('Failed to save changes'));
        } finally {
            setIsSaving(false);
        }
    }, [onSaveAllEdits, t]);

    // Handle discard all edits - revert values in iframe first
    const handleDiscardAll = useCallback(() => {
        if (!onDiscardAllEdits) return;
        revertEdits(pendingEdits);
        onDiscardAllEdits();
    }, [revertEdits, pendingEdits, onDiscardAllEdits]);

    // Handle remove single edit - revert value in iframe first
    const handleRemoveEdit = useCallback((id: string) => {
        const edit = pendingEdits.find(e => e.id === id);
        if (edit) {
            revertEdits([edit]);
        }
        onRemoveEdit?.(id);
    }, [pendingEdits, revertEdits, onRemoveEdit]);

    if (previewUrl) {
        return (
            <div ref={containerRef} className="h-full w-full flex flex-col bg-background relative overflow-hidden">
                <GradientBackground />

                {/* Unified toolbar bar */}
                <div className="h-10 px-3 border-b flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-sm z-20">
                    <div className="flex items-center gap-1.5">
                        {/* Mode toggles */}
                        <Button
                            variant={mode === 'inspect' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onModeChange?.(mode === 'inspect' ? 'preview' : 'inspect')}
                            className="h-7 px-3 text-xs"
                        >
                            <MousePointerClick className="h-3.5 w-3.5 me-1.5" />
                            {t('Inspect')}
                        </Button>
                        <Button
                            variant={mode === 'design' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onModeChange?.(mode === 'design' ? 'preview' : 'design')}
                            className="h-7 px-3 text-xs"
                        >
                            <Palette className="h-3.5 w-3.5 me-1.5" />
                            {t('Design')}
                        </Button>

                    </div>

                    <DeviceWidthToggle value={device} onChange={setDevice} />

                    {/* Right side: hints + Undo/Redo */}
                    <div data-testid="toolbar-actions" className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                        {mode === 'inspect' && !isReady && !isBuilding && (
                            <span className="hidden sm:flex text-xs text-muted-foreground items-center gap-1.5">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('Initializing...')}
                            </span>
                        )}
                        {mode === 'inspect' && isReady && !isBuilding && (
                            <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {t('Click any element to see options')}
                            </span>
                        )}

                        {mode === 'inspect' && <div className="w-px h-5 bg-border mx-1" />}

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
                    </div>
                </div>

                {/* Main content area */}
                <div className="flex-1 min-h-0 flex relative z-10">
                    {/* Theme designer panel - only in design mode. Below `lg` it renders as an
                        absolute left-anchored overlay (with a dismissible backdrop) instead of
                        docking, so it doesn't crush the iframe down to an unusable sliver on
                        phones/tablets; at `lg`+ it docks inline like before. */}
                    {mode === 'design' && themeDesignerSlot && (
                        <>
                            <div
                                data-testid="design-panel-backdrop"
                                className="absolute inset-0 z-10 bg-black/30 lg:hidden"
                                onClick={() => onModeChange?.('preview')}
                            />
                            <div
                                data-testid="design-panel"
                                className="absolute inset-y-0 start-0 z-20 h-full w-80 max-w-[85vw] border-e bg-background shadow-lg overflow-hidden lg:static lg:z-auto lg:max-w-none lg:shadow-none lg:shrink-0"
                            >
                                <div className="flex items-center justify-between border-b px-3 py-2 lg:hidden">
                                    <span className="text-xs font-medium text-muted-foreground">{t('Design')}</span>
                                    <button
                                        type="button"
                                        onClick={() => onModeChange?.('preview')}
                                        className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted lg:hidden"
                                        aria-label={t('Close')}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                {themeDesignerSlot}
                            </div>
                        </>
                    )}

                    {/* iframe container - centered device-width frame */}
                    <div className="flex-1 min-h-0 flex justify-center bg-muted/30">
                        <div
                            data-testid="device-frame"
                            style={device !== 'full' ? { maxWidth: DEVICE_WIDTHS[device] } : undefined}
                            className={cn('relative h-full w-full', device !== 'full' && 'border-x shadow-sm')}
                        >
                            <iframe
                                ref={iframeRef}
                                key={refreshTrigger}
                                src={`${previewUrl}?t=${refreshTrigger}`}
                                className="absolute inset-0 w-full h-full border-0"
                                title={t('Preview')}
                                sandbox="allow-scripts allow-same-origin"
                            />

                            {/* Confetti canvas */}
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 z-30 pointer-events-none w-full h-full"
                            />

                            {/* Building overlay */}
                            {isBuilding && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-md">
                                    <BuildingAnimation t={t} />
                                </div>
                            )}

                            {/* Design saving overlay - only in design mode */}
                            {mode === 'design' && isSavingTheme && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-md">
                                    <BuildingAnimation t={t} title={t('Applying design...')} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pending edits panel - visible when inspect active or when edits exist */}
                {(mode === 'inspect' || pendingEdits.length > 0) && (
                    <PendingEditsPanel
                        edits={pendingEdits}
                        onSaveAll={handleSaveAll}
                        onDiscardAll={handleDiscardAll}
                        onRemoveEdit={handleRemoveEdit}
                        isSaving={isSaving}
                    />
                )}

                {/* Floating toolbar - shows when element selected in inspect mode */}
                {mode === 'inspect' && contextMenu && adjustedContextElement && createPortal(
                    <ElementToolbar
                        element={adjustedContextElement}
                        onEdit={() => handleEdit(contextMenu.element)}
                        onStyle={() => handleOpenStyle(contextMenu.element)}
                        onAiEdit={() => handleAiEdit(contextMenu.element)}
                        onImage={contextMenu.element.tagName === 'img' ? () => {
                            setImageElement(contextMenu.element);
                            setImagePanelOpen(true);
                        } : undefined}
                        onClose={closeContextMenu}
                    />,
                    document.body
                )}

                {/* Style panel - shows when Style button clicked */}
                {mode === 'inspect' && stylePanelOpen && styleElement && createPortal(
                    <StylePanel
                        element={styleElement}
                        classes={styleClasses}
                        onUpdateClasses={updateStyleClasses}
                        onApply={handleStyleApply}
                        onReset={resetStyleClasses}
                        onClose={closeStylePanel}
                    />,
                    document.body
                )}

                {/* Image swap panel - shows when Image button clicked on img element */}
                {mode === 'inspect' && imagePanelOpen && imageElement && projectId && createPortal(
                    <ImageSwapPanel
                        element={imageElement}
                        projectId={projectId}
                        storageEnabled={storageEnabled}
                        maxFileSizeMb={maxFileSizeMb}
                        onApply={(newSrc) => {
                            if (iframeRef.current?.contentWindow) {
                                iframeRef.current.contentWindow.postMessage({
                                    type: 'inspector-update-image-src',
                                    selector: imageElement.cssSelector,
                                    newSrc,
                                }, '*');
                            }
                            onElementEdit?.({
                                id: `edit-img-${Date.now()}`,
                                element: imageElement,
                                field: 'src',
                                originalValue: imageElement.attributes?.src || '',
                                newValue: newSrc,
                                timestamp: new Date(),
                            });
                            setImagePanelOpen(false);
                            setImageElement(null);
                        }}
                        onClose={() => { setImagePanelOpen(false); setImageElement(null); }}
                    />,
                    document.body
                )}

                {/* Revision history panel */}
                {projectId && (
                    <RevisionHistoryPanel
                        open={revisionPanelOpen}
                        onOpenChange={setRevisionPanelOpen}
                        projectId={projectId}
                        refreshTrigger={refreshTrigger}
                        onRestore={onRestoreRevision}
                    />
                )}
            </div>
        );
    }

    // Empty state
    return (
        <div ref={containerRef} className="h-full w-full flex items-center justify-center bg-background relative overflow-hidden">
            <GradientBackground />
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-30 pointer-events-none w-full h-full"
            />
            <div className="relative z-10 flex flex-col items-center text-center max-w-sm px-6">
                {isBuilding ? (
                    <BuildingAnimation t={t} />
                ) : (
                    <div className="prose prose-sm dark:prose-invert">
                        <h3 className="text-2xl font-semibold bg-gradient-to-r from-primary to-primary/80 dark:from-primary dark:to-primary/70 bg-clip-text text-transparent mb-3">
                            {t('Nothing built yet')}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            {outputTarget === 'wordpress_theme'
                                ? t('Start a conversation with the AI to build your theme. Your project will appear here.')
                                : t('Start a conversation with the AI to build your website. Your project will appear here.')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default InspectPreview;
