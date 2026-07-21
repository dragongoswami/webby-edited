import { Link, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import AdminLayout from '@/Layouts/AdminLayout';
import StatusPill, { TicketStatus } from '@/components/Tickets/StatusPill';
import { useAdminTicketsChannel } from '@/hooks/useAdminTicketsChannel';
import { PageProps } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAppDate } from '@/lib/date';
import { useAdminLoading } from '@/hooks/useAdminLoading';
import { AdminPageHeader } from '@/components/Admin/AdminPageHeader';
import { TanStackDataTable } from '@/components/Admin/TanStackDataTable';
import { TableSkeleton, type TableColumnConfig } from '@/components/Admin/skeletons';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

type Row = {
    reference: string;
    subject: string;
    status: TicketStatus;
    user?: { id: number; name: string; email: string } | null;
    project?: { id: string; name: string } | null;
    assigned_admin?: { id: number; name: string } | null;
    last_message_at: string;
    created_at: string;
};

type Props = {
    tickets: {
        data: Row[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
    filters: { status: string; assignee: string; search: string };
    admins: { id: number; name: string }[];
};

const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-24' },
    { type: 'text', width: 'w-64' },
    { type: 'text', width: 'w-40' },
    { type: 'badge', width: 'w-20' },
    { type: 'text', width: 'w-24' },
    { type: 'date', width: 'w-24' },
];

export default function AdminTicketsIndex({ tickets, filters, admins }: Props) {
    const { t } = useTranslation();
    const { formatDateTime } = useAppDate();
    const { auth } = usePage<PageProps>().props;
    const { isLoading } = useAdminLoading();
    const [searchValue, setSearchValue] = useState(filters.search || '');
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refresh = useCallback(() => router.reload({ only: ['tickets'] }), []);
    useAdminTicketsChannel(refresh);

    const apply = (next: Partial<typeof filters & { page: number }>) => {
        router.get(
            route('admin.tickets.index'),
            { ...filters, ...next },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleSearch = (value: string) => {
        setSearchValue(value);
        if (searchTimer.current) {
            clearTimeout(searchTimer.current);
        }
        searchTimer.current = setTimeout(() => {
            apply({ search: value || undefined, page: 1 });
        }, 300);
    };

    useEffect(() => {
        return () => {
            if (searchTimer.current) {
                clearTimeout(searchTimer.current);
            }
        };
    }, []);

    const handlePageChange = (page: number) => apply({ page: page + 1 });
    const handlePageSizeChange = (size: number) =>
        router.get(
            route('admin.tickets.index'),
            { ...filters, per_page: size, page: 1 },
            { preserveState: true, preserveScroll: true },
        );

    const columns: ColumnDef<Row>[] = [
        {
            accessorKey: 'reference',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Ref')} />,
            cell: ({ row }) => (
                <Link
                    href={route('admin.tickets.show', row.original.reference)}
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
                    href={route('admin.tickets.show', row.original.reference)}
                    className="block max-w-xs truncate font-medium hover:underline"
                >
                    {row.original.subject}
                </Link>
            ),
        },
        {
            accessorKey: 'user',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('User')} />,
            cell: ({ row }) => {
                const u = row.original.user;
                return u ? (
                    <div className="min-w-0">
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                );
            },
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Status')} />,
            cell: ({ row }) => <StatusPill status={row.original.status} />,
        },
        {
            accessorKey: 'assigned_admin',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Assignee')} />,
            cell: ({ row }) =>
                row.original.assigned_admin ? (
                    row.original.assigned_admin.name
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            accessorKey: 'last_message_at',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Activity')} />,
            cell: ({ row }) => (
                <time
                    dateTime={row.original.last_message_at}
                    className="text-xs text-muted-foreground"
                >
                    {formatDateTime(row.original.last_message_at)}
                </time>
            ),
        },
    ];

    return (
        <AdminLayout user={auth.user!} title={t('Support tickets')}>
            <AdminPageHeader
                title={t('Support tickets')}
                subtitle={t('Manage user-submitted support tickets.')}
            />

            <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-sm">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('Search reference, subject, email, body…')}
                            value={searchValue}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="ps-9 w-[320px]"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Select
                            value={filters.status || 'all'}
                            onValueChange={(v) => apply({ status: v, page: 1 })}
                        >
                            <SelectTrigger className="w-[140px] h-8">
                                <SelectValue placeholder={t('Status')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All statuses')}</SelectItem>
                                <SelectItem value="open">{t('Open')}</SelectItem>
                                <SelectItem value="pending">{t('Pending')}</SelectItem>
                                <SelectItem value="closed">{t('Closed')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.assignee || 'all'}
                            onValueChange={(v) => apply({ assignee: v, page: 1 })}
                        >
                            <SelectTrigger className="w-[160px] h-8">
                                <SelectValue placeholder={t('Assignee')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('Any assignee')}</SelectItem>
                                <SelectItem value="me">{t('Assigned to me')}</SelectItem>
                                <SelectItem value="unassigned">{t('Unassigned')}</SelectItem>
                                {admins.map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)}>
                                        {a.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isLoading ? (
                    <TableSkeleton columns={skeletonColumns} rows={10} rowsOnly />
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
