import { Bot, Cog, Wrench } from 'lucide-react';

/**
 * The shared "building" animation used by the live preview overlays (website
 * build and WordPress Playground boot/install). A card with bouncing/spinning
 * tool icons and a title + subtitle.
 */
export function BuildingAnimation({
    t,
    title,
    subtitle,
}: {
    t: (key: string) => string;
    title?: string;
    subtitle?: string;
}) {
    return (
        <div className="flex flex-col items-center gap-5 bg-card px-10 py-8 rounded-xl shadow-xl">
            <div className="flex items-center gap-4">
                <div className="animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}>
                    <Bot className="h-8 w-8 text-primary" />
                </div>
                <div className="animate-spin" style={{ animationDuration: '3s' }}>
                    <Cog className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }}>
                    <Wrench className="h-8 w-8 text-primary" />
                </div>
            </div>
            <div className="text-center">
                <h3 className="font-medium text-lg">{title ?? t('Building your site...')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{subtitle ?? t('This may take a moment')}</p>
            </div>
        </div>
    );
}
