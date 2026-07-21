import { FormEvent, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import AdminLayout from '@/Layouts/AdminLayout';
import { AdminPageHeader } from '@/components/Admin/AdminPageHeader';
import { TanStackDataTable } from '@/components/Admin/TanStackDataTable';
import { TableSkeleton, type TableColumnConfig } from '@/components/Admin/skeletons';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import StatusPill, { TicketStatus } from '@/components/Tickets/StatusPill';
import AttachmentDropzone from '@/components/Tickets/AttachmentDropzone';
import RichTextEditor from '@/components/Tickets/RichTextEditor';
import { PageProps } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAppDate } from '@/lib/date';
import { usePageLoading } from '@/hooks/usePageLoading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

type Row = {
    reference: string;
    subject: string;
    status: TicketStatus;
    last_message_at: string;
    latest_message?: { body_preview: string } | null;
};

type Props = {
    tickets: {
        data: Row[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filter: 'all' | 'open' | 'pending' | 'closed';
    planEnabled: boolean;
    openLimit: number | null;
    openCount: number;
    projects: { id: string; name: string }[];
};

const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-24' },
    { type: 'text', width: 'w-64' },
    { type: 'badge', width: 'w-20' },
    { type: 'date', width: 'w-24' },
];

export default function SupportIndex({
    tickets,
    filter,
    planEnabled,
    openLimit,
    openCount,
    projects,
}: Props) {
    const { t } = useTranslation();
    const { formatDate } = useAppDate();
    const { auth } = usePage<PageProps>().props;
    const { isLoading } = usePageLoading();

    const limitReached = openLimit !== null && openCount >= openLimit;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [projectId, setProjectId] = useState<string>('');
    const [files, setFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    function resetForm() {
        setSubject('');
        setBody('');
        setProjectId('');
        setFiles([]);
        setFormErrors({});
    }

    function submit(e: FormEvent) {
        e.preventDefault();
        const data = new FormData();
        data.append('subject', subject);
        data.append('body', body);
        if (projectId) data.append('project_id', projectId);
        files.forEach((f) => data.append('attachments[]', f));

        setProcessing(true);
        setFormErrors({});
        router.post(route('support.tickets.store'), data, {
            forceFormData: true,
            onSuccess: () => {
                setDialogOpen(false);
                resetForm();
            },
            onError: (e) => setFormErrors(e as Record<string, string>),
            onFinish: () => setProcessing(false),
        });
    }

    function handlePageChange(page: number) {
        router.get(
            route('support.tickets.index'),
            { status: filter, page: page + 1 },
            { preserveState: true, preserveScroll: true },
        );
    }

    function handlePageSizeChange(size: number) {
        router.get(
            route('support.tickets.index'),
            { status: filter, per_page: size, page: 1 },
            { preserveState: true, preserveScroll: true },
        );
    }

    const columns: ColumnDef<Row>[] = [
        {
            accessorKey: 'reference',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Ref')} />,
            cell: ({ row }) => (
                <Link
                    href={route('support.tickets.show', row.original.reference)}
                    className="font-mono text-xs text-primary hover:underline"
                >
                    {row.original.reference}
                </Link>
            ),
        },
        {
            accessorKey: 'subject',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Subject')} />,
            cell: ({ row }) => (
                <Link
                    href={route('support.tickets.show', row.original.reference)}
                    className="block min-w-0 hover:underline"
                >
                    <p className="truncate font-medium">{row.original.subject}</p>
                    {row.original.latest_message && (
                        <p className="truncate text-xs text-muted-foreground">
                            {row.original.latest_message.body_preview}
                        </p>
                    )}
                </Link>
            ),
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Status')} />,
            cell: ({ row }) => <StatusPill status={row.original.status} />,
        },
        {
            accessorKey: 'last_message_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Activity')} />,
            cell: ({ row }) => (
                <time dateTime={row.original.last_message_at} className="text-xs text-muted-foreground">
                    {formatDate(row.original.last_message_at)}
                </time>
            ),
        },
    ];

    const newTicketDialog = (
        <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
            }}
        >
            <DialogTrigger asChild>
                <Button
                    disabled={limitReached}
                    aria-describedby={limitReached ? 'new-ticket-limit-reason' : undefined}
                >
                    <Plus className="h-4 w-4 me-2" />
                    {t('New ticket')}
                </Button>
            </DialogTrigger>
            {limitReached && (
                <span id="new-ticket-limit-reason" className="sr-only">
                    {t('Open ticket limit reached')}
                </span>
            )}
            <DialogContent
                className="sm:max-w-lg"
                onEscapeKeyDown={(e) => {
                    // The RichTextEditor opens its own Dialog (link insertion).
                    // Without this guard, pressing Escape inside that inner
                    // dialog bubbles up and closes the outer one too. Suppress
                    // Escape on this layer; users can press Escape again once
                    // the inner dialog has closed.
                    if (document.querySelector('[role="dialog"][data-state="open"]:not(.sm\\:max-w-lg)')) {
                        e.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{t('New ticket')}</DialogTitle>
                    <DialogDescription>
                        {openLimit !== null
                            ? t(':count of :limit open tickets used.', {
                                  count: openCount,
                                  limit: openLimit,
                              })
                            : t('Tell us what is happening and we will get back to you.')}
                    </DialogDescription>
                </DialogHeader>
                <form id="new-ticket-form" onSubmit={submit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="ticket-subject">{t('Subject')}</Label>
                        <Input
                            id="ticket-subject"
                            value={subject}
                            maxLength={200}
                            placeholder={t('Brief summary of your issue')}
                            onChange={(e) => setSubject(e.target.value)}
                            className={formErrors.subject ? 'border-destructive' : ''}
                            required
                        />
                        {formErrors.subject && (
                            <p className="text-sm text-destructive">{formErrors.subject}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ticket-project">{t('Project (optional)')}</Label>
                        <Select
                            value={projectId === '' ? '__none__' : projectId}
                            onValueChange={(v) => setProjectId(v === '__none__' ? '' : v)}
                        >
                            <SelectTrigger id="ticket-project">
                                <SelectValue placeholder={t('No project')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">{t('No project')}</SelectItem>
                                {projects.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="ticket-body">{t('Describe the issue')}</Label>
                        <RichTextEditor
                            value={body}
                            onChange={setBody}
                            placeholder={t('Tell us what happened, what you tried, and what you expected. Steps to reproduce help us fix things faster.')}
                            invalid={!!formErrors.body}
                            ariaLabel={t('Describe the issue')}
                        />
                        {formErrors.body && (
                            <p className="text-sm text-destructive">{formErrors.body}</p>
                        )}
                    </div>
                    <AttachmentDropzone files={files} onChange={setFiles} />
                </form>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">
                        {t('Cancel')}
                    </Button>
                    <Button type="submit" form="new-ticket-form" disabled={processing}>
                        {processing ? t('Submitting…') : t('Submit ticket')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    const action = planEnabled ? (
        newTicketDialog
    ) : (
        <Button asChild variant="outline">
            <Link href={route('billing.plans')}>{t('Upgrade your plan to file support tickets.')}</Link>
        </Button>
    );

    const tabs: Array<{ key: 'all' | 'open' | 'pending' | 'closed'; label: string }> = [
        { key: 'all', label: t('All') },
        { key: 'open', label: t('Open') },
        { key: 'pending', label: t('Awaiting you') },
        { key: 'closed', label: t('Closed') },
    ];

    return (
        <AdminLayout user={auth.user!} title={t('Support')}>
            <AdminPageHeader
                title={t('Support')}
                subtitle={t('Your support tickets and conversations with our team.')}
                action={action}
            />

            <div className="space-y-4">
                <nav className="flex flex-wrap gap-2 text-sm">
                    {tabs.map(({ key, label }) => (
                        <button
                            key={key}
                            aria-pressed={filter === key}
                            onClick={() =>
                                router.get(
                                    route('support.tickets.index'),
                                    { status: key },
                                    { preserveState: true, preserveScroll: true },
                                )
                            }
                            className={`rounded-full px-3 py-1 ${
                                filter === key
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground hover:bg-muted/80'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                {isLoading ? (
                    <TableSkeleton columns={skeletonColumns} rows={6} showSearch={false} />
                ) : (
                    <TanStackDataTable
                        columns={columns}
                        data={tickets.data}
                        showSearch={false}
                        serverPagination={{
                            pageCount: tickets.last_page,
                            pageIndex: tickets.current_page - 1,
                            pageSize: tickets.per_page,
                            total: tickets.total,
                            onPageChange: handlePageChange,
                            onPageSizeChange: handlePageSizeChange,
                        }}
                    />
                )}
            </div>
        </AdminLayout>
    );
}
