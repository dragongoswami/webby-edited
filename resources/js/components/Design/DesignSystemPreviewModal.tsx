import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface DesignSystemPreviewModalProps {
    slug: string;
    name: string;
    /** Accent to theme the preview with (null/undefined = the system's default). */
    accent?: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Full-size, scrollable preview of a design system's standalone styleguide demo,
 * rendered in a sandboxed iframe inside a large dialog. The demo carries its own
 * light/dark switch and accent showcase, so no theming controls are added here.
 */
export function DesignSystemPreviewModal({ slug, name, accent = null, open, onOpenChange }: DesignSystemPreviewModalProps) {
    const { t } = useTranslation();
    const url = route('design-systems.preview', slug) + (accent ? `?accent=${encodeURIComponent(accent)}` : '');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showClose={false}
                className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
            >
                <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-3">
                    <DialogTitle className="truncate text-base">
                        {t(':name Design System', { name })}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('Preview of :name', { name })}
                    </DialogDescription>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 me-1.5" />
                                {t('Open in new tab')}
                            </a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                            {t('Close')}
                        </Button>
                    </div>
                </DialogHeader>
                {open && (
                    <iframe
                        src={url}
                        title={t('Preview of :name', { name })}
                        sandbox="allow-scripts"
                        className="min-h-0 flex-1 border-0 bg-background"
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
