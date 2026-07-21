import { useState, useEffect, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import axios from 'axios';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { AppPageHeader } from '@/components/Header/AppPageHeader';
import { Toaster } from '@/components/ui/sonner';
import { TanStackDataTable } from '@/components/Admin/TanStackDataTable';
import { TableSkeleton, type TableColumnConfig } from '@/components/Admin/skeletons';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuLabel,
} from '@/components/ui/table-action-menu';
import {
    Trash2,
    Loader2,
    Github,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';
import type { User } from '@/types';

interface Connection {
    id: number;
    label: string;
    github_login: string;
    account_type: string;
    status: string;
    last_used_at: string | null;
    created_at: string;
}

interface GithubPageProps {
    auth: {
        user: User;
    };
}

const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-56' },
    { type: 'badge', width: 'w-20' },
    { type: 'date', width: 'w-32' },
    { type: 'date', width: 'w-32' },
    { type: 'actions', width: 'w-12' },
];

export default function GithubIndex({ auth }: GithubPageProps) {
    const user = auth.user;
    const { t } = useTranslation();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);

    const loadConnections = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get('/github-connections');
            setConnections(response.data);
        } catch {
            toast.error(t('Failed to load connections'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadConnections();
    }, [loadConnections]);

    // Full-page redirect — the connect route bounces to github.com, so Inertia's
    // client-side router must not handle it.
    const handleConnect = () => {
        window.location.href = '/github/connect';
    };

    const handleDelete = (connection: Connection) => {
        setDeleteTarget(connection);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const connection = deleteTarget;
        setDeletingId(connection.id);
        try {
            await axios.delete('/github-connections/' + connection.id);
            toast.success(t('Connection deleted'));
            setDeleteTarget(null);
            await loadConnections();
        } catch {
            toast.error(t('Failed to delete connection'));
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (value: string | null) => {
        if (!value) return null;
        try {
            return new Date(value).toLocaleString();
        } catch {
            return value;
        }
    };

    const columns: ColumnDef<Connection>[] = [
        {
            accessorKey: 'github_login',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Account')} />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <Github className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{row.original.github_login}</span>
                    <Badge variant="outline">{row.original.account_type}</Badge>
                </div>
            ),
        },
        {
            id: 'status',
            enableSorting: false,
            header: () => t('Status'),
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'revoked' ? 'destructive' : status === 'active' ? 'outline' : 'secondary';
                const label = status === 'active' ? t('Active') : status === 'revoked' ? t('Revoked') : status;
                return <Badge variant={variant}>{label}</Badge>;
            },
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Created')} />
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.original.created_at ? formatDate(row.original.created_at) : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'last_used_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Last used')} />
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.original.last_used_at ? formatDate(row.original.last_used_at) : '—'}
                </span>
            ),
        },
        {
            id: 'actions',
            enableHiding: false,
            cell: ({ row }) => {
                const connection = row.original;
                return (
                    <TableActionMenu>
                        <TableActionMenuTrigger />
                        <TableActionMenuContent>
                            <TableActionMenuLabel>{t('Actions')}</TableActionMenuLabel>
                            <TableActionMenuItem
                                onClick={() => handleDelete(connection)}
                                disabled={deletingId === connection.id}
                                variant="destructive"
                            >
                                {deletingId === connection.id ? (
                                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4 me-2" />
                                )}
                                {t('Remove')}
                            </TableActionMenuItem>
                        </TableActionMenuContent>
                    </TableActionMenu>
                );
            },
        },
    ];

    return (
        <>
            <Head title={t('GitHub')} />
            <Toaster />

            <TooltipProvider>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset>
                        <div className="min-h-screen bg-background">
                            <AppPageHeader user={user} />

                            <main className="p-4 md:p-6 lg:p-8">
                                <div className="max-w-7xl mx-auto">
                                    {/* Page header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                        <div>
                                            <h1 className="text-2xl font-bold text-foreground">
                                                {t('GitHub')}
                                            </h1>
                                            <p className="text-muted-foreground mt-1">
                                                {t('Connect GitHub to push your projects to your own repositories.')}
                                            </p>
                                        </div>
                                        <Button type="button" onClick={handleConnect} className="shrink-0">
                                            <Github className="h-4 w-4 me-2" />
                                            {t('Connect GitHub')}
                                        </Button>
                                    </div>

                                    {/* Connections table */}
                                    {loading ? (
                                        <TableSkeleton columns={skeletonColumns} rows={5} />
                                    ) : connections.length === 0 ? (
                                        <EmptyState
                                            variant="card"
                                            icon={<Github className="h-12 w-12" />}
                                            title={t('No GitHub connections yet')}
                                            description={t('Connect your GitHub account to start pushing project code to your own repositories.')}
                                            action={
                                                <Button type="button" onClick={handleConnect}>
                                                    <Github className="h-4 w-4 me-2" />
                                                    {t('Connect GitHub')}
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <TanStackDataTable
                                            columns={columns}
                                            data={connections}
                                            searchColumn="github_login"
                                            searchPlaceholder={t('Search connections...')}
                                        />
                                    )}
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Are you sure you want to delete this connection?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This action cannot be undone.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteTarget !== null && deletingId === deleteTarget.id}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {t('Remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
