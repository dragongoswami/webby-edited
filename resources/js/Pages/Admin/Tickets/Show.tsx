import { Link, router, usePage } from '@inertiajs/react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Lock, RotateCcw } from 'lucide-react';
import { useAdminLoading } from '@/hooks/useAdminLoading';
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
        assigned_admin?: { id: number; name: string } | null;
        user?: {
            id: number;
            name: string;
            email: string;
            plan?: { id: number; name: string } | null;
        } | null;
        project?: { id: string; name: string } | null;
    };
    messages: MessagesPaginator;
    admins: { id: number; name: string }[];
    userStats: { ticketCount: number; projectCount: number };
};

export default function AdminTicketShow({ ticket, messages, admins, userStats }: Props) {
    const { t } = useTranslation();
    const { auth } = usePage<PageProps>().props;
    const { isLoading } = useAdminLoading();
    const closed = ticket.status === 'closed';

    function assign(value: string) {
        router.post(
            route('admin.tickets.assign', ticket.reference),
            { admin_id: value === '__none__' ? null : Number(value) },
            { preserveScroll: true },
        );
    }

    const title = (
        <span className="flex items-center gap-3">
            <span>{ticket.subject}</span>
            <StatusPill status={ticket.status} />
        </span>
    );

    const subtitle = ticket.user
        ? `${ticket.user.name} · ${ticket.user.email} · ${ticket.reference}`
        : `${t('Deleted user')} · ${ticket.reference}`;

    return (
        <AdminLayout user={auth.user!} title={`${ticket.reference} · ${ticket.subject}`}>
            <AdminPageHeader
                title={title}
                subtitle={subtitle}
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        {closed ? (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.post(
                                        route('admin.tickets.reopen', ticket.reference),
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <RotateCcw className="h-4 w-4 me-1.5" />
                                {t('Reopen')}
                            </Button>
                        ) : (
                            <Button
                                onClick={() =>
                                    router.post(
                                        route('admin.tickets.close', ticket.reference),
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <Lock className="h-4 w-4 me-1.5" />
                                {t('Close')}
                            </Button>
                        )}
                        <Button asChild variant="outline">
                            <Link href={route('admin.tickets.index')}>
                                <ArrowLeft className="h-4 w-4 me-1.5" />
                                {t('Back')}
                            </Link>
                        </Button>
                    </div>
                }
            />

            <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
                <div className="space-y-4">
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
                            {closed && (
                                <p className="mb-3 text-xs text-muted-foreground">
                                    {t('This ticket is closed. Sending a reply will reopen it.')}
                                </p>
                            )}
                            <ReplyComposer action={route('admin.tickets.reply', ticket.reference)} />
                        </CardContent>
                    </Card>
                </div>

                <aside className="space-y-3">
                    <Card>
                        <CardContent className="space-y-3 p-4 text-sm">
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('User')}
                            </h2>
                            <div>
                                <p className="font-medium">{ticket.user?.name ?? t('Deleted user')}</p>
                                <p className="text-xs text-muted-foreground">{ticket.user?.email}</p>
                            </div>
                            <dl className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">{t('Plan')}</dt>
                                    <dd>{ticket.user?.plan?.name ?? '—'}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">{t('Tickets')}</dt>
                                    <dd>{userStats.ticketCount}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-muted-foreground">{t('Projects')}</dt>
                                    <dd>{userStats.projectCount}</dd>
                                </div>
                            </dl>
                            <div className="space-y-1.5 border-t pt-3">
                                <p className="text-xs text-muted-foreground">{t('Assignee')}</p>
                                <Select
                                    defaultValue={ticket.assigned_admin ? String(ticket.assigned_admin.id) : '__none__'}
                                    onValueChange={assign}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">{t('Unassigned')}</SelectItem>
                                        {admins.map((a) => (
                                            <SelectItem key={a.id} value={String(a.id)}>
                                                {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {ticket.project && (
                        <Card>
                            <CardContent className="space-y-2 p-4 text-sm">
                                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t('Project')}
                                </h2>
                                <p className="font-medium">{ticket.project.name}</p>
                            </CardContent>
                        </Card>
                    )}
                </aside>
            </div>
        </AdminLayout>
    );
}
