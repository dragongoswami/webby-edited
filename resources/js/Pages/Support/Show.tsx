import { Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import ConversationTimeline, { TicketTimelineMessage } from '@/components/Tickets/ConversationTimeline';
import ReplyComposer from '@/components/Tickets/ReplyComposer';
import StatusPill, { TicketStatus } from '@/components/Tickets/StatusPill';
import PaginationLinks from '@/components/Tickets/PaginationLinks';
import { PageProps } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { AdminPageHeader } from '@/components/Admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { usePageLoading } from '@/hooks/usePageLoading';
import { TicketThreadSkeleton } from '@/components/skeletons';

type MessagesPaginator = {
    data: TicketTimelineMessage[];
    links: { url: string | null; label: string; active: boolean }[];
    current_page: number;
    last_page: number;
};

type Props = {
    ticket: {
        reference: string;
        subject: string;
        status: TicketStatus;
        project?: { id: string; name: string } | null;
    };
    messages: MessagesPaginator;
    canReply: boolean;
};

export default function SupportShow({ ticket, messages, canReply }: Props) {
    const { t } = useTranslation();
    const { auth } = usePage<PageProps>().props;
    const { isLoading } = usePageLoading();
    const isClosed = ticket.status === 'closed';

    const title = (
        <span className="flex items-center gap-3">
            <span>{ticket.subject}</span>
            <StatusPill status={ticket.status} />
        </span>
    );

    const subtitle = ticket.project
        ? `${t('Project')}: ${ticket.project.name} · ${ticket.reference}`
        : ticket.reference;

    return (
        <AdminLayout user={auth.user!} title={`${ticket.reference} · ${ticket.subject}`}>
            <AdminPageHeader
                title={title}
                subtitle={subtitle}
                action={
                    <Button asChild variant="outline">
                        <Link href={route('support.tickets.index')}>
                            <ArrowLeft className="h-4 w-4 me-1.5" />
                            {t('Back')}
                        </Link>
                    </Button>
                }
            />

            <div className="space-y-3">
                <Card>
                    <CardContent className="p-4">
                        {isLoading ? (
                            <TicketThreadSkeleton />
                        ) : (
                            <ConversationTimeline
                                messages={messages.data}
                                attachmentBaseUrl={`/support/tickets/${ticket.reference}/attachments`}
                            />
                        )}
                        {messages.last_page > 1 && (
                            <PaginationLinks links={messages.links} />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <ReplyComposer
                            action={route('support.tickets.reply', ticket.reference)}
                            disabled={!canReply}
                            disabledMessage={
                                isClosed
                                    ? t('This ticket is closed. Reply to reopen it.')
                                    : t('You cannot reply to this ticket.')
                            }
                        />
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
