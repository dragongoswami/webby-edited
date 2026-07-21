import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChatMessage } from '@/types/chat';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/Markdown/MarkdownRenderer';
import { Image, Paperclip } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { translateBuilderMessage } from '@/lib/builderTranslations';
import { SyntheticEvent, isSyntheticEvent } from './SyntheticEventBubble';

interface MessageBubbleProps {
    message: ChatMessage;
}

function getActivityIcon(activityType?: string): string {
    switch (activityType) {
        case 'creating':
            return '✨';
        case 'editing':
            return '✏️';
        case 'reading':
            return '📖';
        case 'exploring':
            return '🔍';
        case 'thinking':
            return '💭';
        case 'verifying':
            return '✅';
        case 'building':
            return '🔨';
        case 'compacting':
        case 'summarizing':
            return '✂️';
        default:
            return '⚡️';
    }
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const { t } = useTranslation();
    const isUser = message.type === 'user';
    const isActivity = message.type === 'activity';

    if (isUser) {
        // Machine-generated user actions (theme apply, style edit, AI edit,
        // batch save) render as compact left-aligned event bubbles so the
        // transcript doesn't fill with 3 KB of instruction payload. The
        // raw content is still available behind a chevron. Regular user
        // messages fall through to the standard right-aligned bubble.
        //
        // Guard: if a synthetic message also has attachedFiles (no current
        // call site does this, but future callers like an image-aware
        // AI_EDIT might), fall through to the normal bubble so the file
        // chips still render. The cost is that the long prompt shows
        // verbatim in that edge case — acceptable because the alternative
        // is silently dropping the user's attachment.
        if (isSyntheticEvent(message.content) && !message.attachedFiles?.length) {
            return <SyntheticEvent content={message.content} />;
        }

        return (
            <div className="flex justify-end animate-fade-in">
                <div
                    className={cn(
                        'max-w-[85%] min-w-0 overflow-hidden px-4 py-2 rounded-2xl ltr:rounded-br-md rtl:rounded-bl-md break-words',
                        'bg-primary text-primary-foreground'
                    )}
                >
                    {message.attachedFiles && message.attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {message.attachedFiles.map(file => (
                                <span key={file.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-foreground/15 rounded-md text-xs font-medium">
                                    {file.is_image ? <Image className="h-3 w-3 shrink-0" /> : <Paperclip className="h-3 w-3 shrink-0" />}
                                    <span className="truncate max-w-[100px]">{file.filename}</span>
                                </span>
                            ))}
                        </div>
                    )}
                    <MarkdownRenderer content={message.content} variant="onPrimary" />
                </div>
            </div>
        );
    }

    // Activity messages - show as compact AI action bubbles (like prototype)
    if (isActivity) {
        return (
            <div className="flex justify-start animate-fade-in">
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                        {getActivityIcon(message.activityType)}
                    </span>
                    <span className="italic">{translateBuilderMessage(message.content, t)}</span>
                </div>
            </div>
        );
    }

    // Assistant messages
    return (
        <div className="flex justify-start gap-3 animate-fade-in">
            <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    AI
                </AvatarFallback>
            </Avatar>
            <div
                className={cn(
                    'max-w-[85%] min-w-0 overflow-hidden px-4 py-2 rounded-2xl ltr:rounded-bl-md rtl:rounded-br-md break-words',
                    'bg-card text-card-foreground border border-border shadow-sm'
                )}
            >
                <MarkdownRenderer content={message.content} />
            </div>
        </div>
    );
}
