import { useState, useEffect, useCallback } from 'react';
import { Head } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import axios from 'axios';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
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
    ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';
import type { User } from '@/types';

interface Connection {
    id: number;
    label: string;
    shop_domain: string;
    status: string;
    last_used_at: string | null;
    created_at: string;
}

interface ShopifyPageProps {
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

export default function ShopifyIndex({ auth }: ShopifyPageProps) {
    const user = auth.user;
    const { t } = useTranslation();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
    const [connectDialogOpen, setConnectDialogOpen] = useState(false);
    const [shopInput, setShopInput] = useState('');
    const [shopInputError, setShopInputError] = useState('');

    const loadConnections = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get('/shopify-connections');
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

    const openConnect = () => {
        setShopInput('');
        setShopInputError('');
        setConnectDialogOpen(true);
    };

    // Full-page redirect — the connect route bounces to Shopify OAuth, so Inertia's
    // client-side router must not handle it.
    const handleConnect = (e?: React.FormEvent) => {
        e?.preventDefault();
        const shop = shopInput.trim();
        if (!shop) return;
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
            setShopInputError(t('Please enter a valid Shopify domain (e.g. mystore.myshopify.com)'));
            return;
        }
        setShopInputError('');
        window.location.href = '/shopify/connect?shop=' + encodeURIComponent(shop);
    };

    const handleDelete = (connection: Connection) => {
        setDeleteTarget(connection);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const connection = deleteTarget;
        setDeletingId(connection.id);
        try {
            await axios.delete('/shopify-connections/' + connection.id);
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
            accessorKey: 'shop_domain',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Store')} />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{row.original.shop_domain}</span>
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
            <Head title={t('Shopify')} />
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
                                                {t('Shopify')}
                                            </h1>
                                            <p className="text-muted-foreground mt-1">
                                                {t('Connect your Shopify store to push generated themes directly.')}
                                            </p>
                                        </div>
                                        <Button type="button" onClick={openConnect} className="shrink-0">
                                            <ShoppingBag className="h-4 w-4 me-2" />
                                            {t('Connect Shopify')}
                                        </Button>
                                    </div>

                                    {/* Connections table */}
                                    {loading ? (
                                        <TableSkeleton columns={skeletonColumns} rows={5} />
                                    ) : connections.length === 0 ? (
                                        <EmptyState
                                            variant="card"
                                            icon={<ShoppingBag className="h-12 w-12" />}
                                            title={t('No Shopify stores connected yet')}
                                            description={t('Connect a Shopify store to start pushing generated themes directly.')}
                                            action={
                                                <Button type="button" onClick={openConnect}>
                                                    <ShoppingBag className="h-4 w-4 me-2" />
                                                    {t('Connect Shopify')}
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <TanStackDataTable
                                            columns={columns}
                                            data={connections}
                                            searchColumn="shop_domain"
                                            searchPlaceholder={t('Search connections...')}
                                        />
                                    )}
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleConnect}>
                        <DialogHeader>
                            <DialogTitle>{t('Connect Shopify store')}</DialogTitle>
                            <DialogDescription>
                                {t("Enter your store's myshopify.com domain. You'll be redirected to Shopify to authorize the connection.")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="shop_domain">{t('Store domain')}</Label>
                                <Input
                                    id="shop_domain"
                                    type="text"
                                    placeholder="mystore.myshopify.com"
                                    value={shopInput}
                                    onChange={(e) => setShopInput(e.target.value)}
                                    autoFocus
                                />
                                {shopInputError && (
                                    <p className="text-sm text-destructive">{shopInputError}</p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setConnectDialogOpen(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={!shopInput.trim()}>
                                <ShoppingBag className="h-4 w-4 me-2" />
                                {t('Connect')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

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
