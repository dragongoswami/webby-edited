import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Eye, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import type { DesignSystemOption } from '@/types/design';
import { DesignSystemThumbnail } from './DesignSystemThumbnail';
import { DesignSystemPreviewModal } from './DesignSystemPreviewModal';

interface DesignDesignerProps {
    designSystems: DesignSystemOption[];
    currentSystemId: number | null;
    currentAccent: string | null;
    onApply: (systemId: number, accent: string | null) => Promise<void>;
    isSaving: boolean;
    /** A chat build is in progress — block applying until it finishes. */
    isBuilding?: boolean;
}

/**
 * Settings "Design" panel: pick an installed design system + accent and ask the
 * AI to re-apply it. Unlike the old theme-preset panel there is no client-side
 * live injection — applying triggers a deterministic builder overlay + rebuild,
 * so the preview reloads with the real design.
 */
export function DesignDesigner({
    designSystems,
    currentSystemId,
    currentAccent,
    onApply,
    isSaving,
    isBuilding = false,
}: DesignDesignerProps) {
    const { t } = useTranslation();
    const accentLabelId = useId();
    // Reflect the project's actual state: don't pre-select a default for an
    // Automatic (currentSystemId === null) project, or the panel would show
    // "Unsaved changes" before the user has touched anything.
    const [selectedSystemId, setSelectedSystemId] = useState<number | null>(currentSystemId);
    const [selectedAccent, setSelectedAccent] = useState<string | null>(currentAccent);
    const [previewSystem, setPreviewSystem] = useState<DesignSystemOption | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const selectedSystem = designSystems.find((d) => d.id === selectedSystemId) ?? null;

    const handleSelectSystem = (system: DesignSystemOption) => {
        setSelectedSystemId(system.id);
        // Reset accent if it isn't offered by the newly selected system.
        if (selectedAccent && !system.accents.includes(selectedAccent)) {
            setSelectedAccent(null);
        }
    };

    const pendingChange = selectedSystemId !== currentSystemId || selectedAccent !== currentAccent;
    const applyDisabled = isSaving || isBuilding || !pendingChange || selectedSystemId === null;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background">
            <div className="p-4 border-b shrink-0">
                <h2 className="text-lg font-semibold">{t('Choose a Design')}</h2>
                <p className="text-sm text-muted-foreground">
                    {t('Pick a design system and accent. The AI re-applies it to your site.')}
                </p>
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-2">
                    {designSystems.map((system) => (
                        <div
                            key={system.id}
                            className={cn(
                                'relative rounded-lg border-2 transition-all',
                                selectedSystemId === system.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                            )}
                        >
                            <button
                                onClick={() => handleSelectSystem(system)}
                                className="w-full p-4 text-start"
                            >
                                <div className="flex items-center gap-3">
                                    <DesignSystemThumbnail
                                        slug={system.slug}
                                        name={t(system.name)}
                                        hasPreview={system.has_preview}
                                        accent={system.id === selectedSystemId ? selectedAccent : null}
                                        className="w-20 shrink-0"
                                    />
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{t(system.name)}</p>
                                        {system.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">{system.description}</p>
                                        )}
                                    </div>
                                </div>
                            </button>
                            {system.has_preview && (
                                <button
                                    type="button"
                                    onClick={() => { setPreviewSystem(system); setPreviewOpen(true); }}
                                    className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
                                    title={t('Preview')}
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    {t('Preview')}
                                </button>
                            )}
                        </div>
                    ))}
                    {designSystems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {t('No design systems are installed.')}
                        </p>
                    )}
                </div>
            </ScrollArea>

            {selectedSystem && selectedSystem.accents.length > 0 && (
                <div className="px-4 py-3 border-t shrink-0 space-y-1.5">
                    <Label id={accentLabelId} className="text-xs font-medium text-muted-foreground">{t('Accent')}</Label>
                    <Select
                        value={selectedAccent ?? 'automatic'}
                        onValueChange={(v) => setSelectedAccent(v === 'automatic' ? null : v)}
                    >
                        <SelectTrigger className="w-full" aria-labelledby={accentLabelId}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="automatic">{t('Default accent')}</SelectItem>
                            {selectedSystem.accents.map((accent) => (
                                <SelectItem key={accent} value={accent}>
                                    <span className="capitalize">{t(accent)}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="p-4 border-t flex items-center justify-between gap-3 shrink-0">
                <p className="text-sm text-muted-foreground">
                    {pendingChange && t('Unsaved changes')}
                </p>
                <Button
                    onClick={() => selectedSystemId !== null && onApply(selectedSystemId, selectedAccent)}
                    disabled={applyDisabled}
                    title={isBuilding ? t('A build is already running. Please wait.') : undefined}
                >
                    {isSaving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {t('Ask AI to apply')}
                </Button>
            </div>

            {previewSystem && (
                <DesignSystemPreviewModal
                    slug={previewSystem.slug}
                    name={t(previewSystem.name)}
                    accent={selectedAccent && previewSystem.accents.includes(selectedAccent) ? selectedAccent : null}
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                />
            )}
        </div>
    );
}
