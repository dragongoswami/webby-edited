import { MessageSquare, Eye } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type MobilePane = 'chat' | 'preview';

interface MobilePaneTabsProps {
    pane: MobilePane;
    onChange: (pane: MobilePane) => void;
    showPreviewDot: boolean;
}

/**
 * Bottom tab bar that lets phones switch between the chat column and the
 * preview/code/settings column of the editor — both are full-width panes on
 * mobile, and only one is ever visible at a time. `md:hidden` — at md+ both
 * columns render side by side and this bar is not shown.
 */
export default function MobilePaneTabs({ pane, onChange, showPreviewDot }: MobilePaneTabsProps) {
    const { t } = useTranslation();

    const tab = (key: MobilePane, Icon: typeof Eye, label: string, dot = false) => (
        <button
            key={key}
            type="button"
            aria-pressed={pane === key}
            onClick={() => onChange(key)}
            className={cn(
                'relative flex h-12 flex-1 items-center justify-center gap-2 text-sm font-medium',
                pane === key ? 'text-primary' : 'text-muted-foreground'
            )}
        >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
            {dot && (
                <span
                    data-testid="preview-dot"
                    className="absolute top-2 ms-14 h-2 w-2 animate-pulse rounded-full bg-primary"
                />
            )}
        </button>
    );

    return (
        <nav className="flex shrink-0 border-t bg-background md:hidden">
            {tab('chat', MessageSquare, t('Chat'))}
            {tab('preview', Eye, t('Preview'), showPreviewDot)}
        </nav>
    );
}
