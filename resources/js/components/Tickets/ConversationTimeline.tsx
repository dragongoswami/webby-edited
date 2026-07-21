import { cn } from '@/lib/utils';
import { Paperclip } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAppDate } from '@/lib/date';

type Attachment = { id: number; original_name: string; size_bytes: number };
type Author = { id: number; name: string; role: 'admin' | 'user'; avatar?: string | null } | null;
export type TicketTimelineMessage = {
    id: number;
    body: string;
    created_at: string;
    user: Author;
    attachments: Attachment[];
};

export default function ConversationTimeline({
    messages,
    attachmentBaseUrl,
}: {
    messages: TicketTimelineMessage[];
    attachmentBaseUrl: string;
}) {
    const { t } = useTranslation();
    const { formatDateTime } = useAppDate();

    if (messages.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('No messages yet.')}</p>;
    }

    return (
        <ol className="space-y-3">
            {messages.map((m) => {
                const isAdmin = m.user?.role === 'admin';
                return (
                    <li
                        key={m.id}
                        className={cn(
                            'rounded-lg border p-4 text-foreground',
                            isAdmin
                                ? 'border-border bg-muted'
                                : 'border-border bg-card',
                        )}
                    >
                        <header className="mb-2 flex items-center gap-2 text-sm text-foreground">
                            <span className="font-medium">{m.user?.name ?? t('Deleted user')}</span>
                            {isAdmin && (
                                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                                    {t('Support')}
                                </span>
                            )}
                            <time
                                dateTime={m.created_at}
                                className="ms-auto text-xs text-muted-foreground"
                                title={m.created_at}
                            >
                                {formatDateTime(m.created_at)}
                            </time>
                        </header>
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none break-words text-foreground [&_p]:text-foreground [&_li]:text-foreground"
                            dangerouslySetInnerHTML={{ __html: m.body }}
                        />
                        {m.attachments.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {m.attachments.map((a) => (
                                    <li key={a.id}>
                                        <a
                                            href={`${attachmentBaseUrl}/${a.id}`}
                                            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
                                        >
                                            <Paperclip className="h-3 w-3" /> {a.original_name}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
