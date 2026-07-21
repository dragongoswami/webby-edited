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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { AppPageHeader } from '@/components/Header/AppPageHeader';
import { Toaster } from '@/components/ui/sonner';
import { TanStackDataTable } from '@/components/Admin/TanStackDataTable';
import { TableSkeleton, type TableColumnConfig } from '@/components/Admin/skeletons';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { NewKeyDialog } from '@/components/ApiKeys/NewKeyDialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuLabel,
} from '@/components/ui/table-action-menu';
import { Plus, Trash2, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';
import type { User } from '@/types';

interface ApiKey {
    id: number;
    name: string;
    masked: string;
    created_at: string | null;
    expires_at: string | null;
    last_used_at: string | null;
}

interface ApiKeysPageProps {
    auth: {
        user: User;
    };
}

const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-48' },
    { type: 'text', width: 'w-32' },
    { type: 'date', width: 'w-32' },
    { type: 'date', width: 'w-32' },
    { type: 'date', width: 'w-32' },
    { type: 'actions', width: 'w-12' },
];

export default function ApiKeysIndex({ auth }: ApiKeysPageProps) {
    const user = auth.user;
    const { t } = useTranslation();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [expiresIn, setExpiresIn] = useState<string>('never');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [revokingId, setRevokingId] = useState<number | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

    const loadKeys = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(route('api-keys.list'));
            setKeys(response.data.keys);
        } catch {
            toast.error(t('Failed to load API keys'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const openCreate = () => {
        setName('');
        setExpiresIn('never');
        setErrors({});
        setCreateOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        try {
            const payload: Record<string, unknown> = { name };
            if (expiresIn !== 'never') {
                payload.expires_in = Number(expiresIn);
            }
            const response = await axios.post(route('api-keys.store'), payload);
            toast.success(t('API key created'));
            setCreateOpen(false);
            setNewToken(response.data.token);
            await loadKeys();
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
                const validationErrors = error.response.data.errors ?? {};
                const flattened: Record<string, string> = {};
                Object.entries(validationErrors).forEach(([key, messages]) => {
                    flattened[key] = Array.isArray(messages) ? messages[0] : String(messages);
                });
                if (Object.keys(flattened).length === 0 && error.response.data.message) {
                    setCreateOpen(false);
                    toast.error(error.response.data.message);
                }
                setErrors(flattened);
            } else {
                toast.error(t('Failed to create API key'));
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRevoke = (key: ApiKey) => {
        setRevokeTarget(key);
    };

    const confirmRevoke = async () => {
        if (!revokeTarget) return;
        const key = revokeTarget;
        setRevokingId(key.id);
        try {
            await axios.delete(route('api-keys.destroy', key.id));
            toast.success(t('API key revoked'));
            setRevokeTarget(null);
            await loadKeys();
        } catch {
            toast.error(t('Failed to revoke API key'));
        } finally {
            setRevokingId(null);
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

    const isExpired = (key: ApiKey) =>
        key.expires_at !== null && new Date(key.expires_at).getTime() < Date.now();

    const columns: ColumnDef<ApiKey>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Name')} />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{row.original.name}</span>
                </div>
            ),
        },
        {
            accessorKey: 'masked',
            header: () => t('Key'),
            enableSorting: false,
            cell: ({ row }) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.original.masked}
                </span>
            ),
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Created')} />
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(row.original.created_at) ?? '—'}
                </span>
            ),
        },
        {
            accessorKey: 'expires_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Expires')} />
            ),
            cell: ({ row }) => {
                if (!row.original.expires_at) {
                    return <span className="text-sm text-muted-foreground">{t('Never')}</span>;
                }
                return (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">
                            {formatDate(row.original.expires_at)}
                        </span>
                        {isExpired(row.original) && (
                            <Badge variant="destructive">{t('Expired')}</Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'last_used_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Last used')} />
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(row.original.last_used_at) ?? t('Never used')}
                </span>
            ),
        },
        {
            id: 'actions',
            enableHiding: false,
            cell: ({ row }) => {
                const key = row.original;
                return (
                    <TableActionMenu>
                        <TableActionMenuTrigger />
                        <TableActionMenuContent>
                            <TableActionMenuLabel>{t('Actions')}</TableActionMenuLabel>
                            <TableActionMenuItem
                                onClick={() => handleRevoke(key)}
                                disabled={revokingId === key.id}
                                variant="destructive"
                            >
                                {revokingId === key.id ? (
                                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4 me-2" />
                                )}
                                {t('Revoke')}
                            </TableActionMenuItem>
                        </TableActionMenuContent>
                    </TableActionMenu>
                );
            },
        },
    ];

    return (
        <>
            <Head title={t('API Keys')} />
            <Toaster />

            <TooltipProvider>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset>
                        <div className="min-h-screen bg-background">
                            <AppPageHeader user={user} />

                            <main className="p-4 md:p-6 lg:p-8">
                                <div className="max-w-7xl mx-auto">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                        <div>
                                            <h1 className="text-2xl font-bold text-foreground">
                                                {t('API Keys')}
                                            </h1>
                                            <p className="text-muted-foreground mt-1">
                                                {t('Create and manage API keys that allow external tools to read your account data.')}
                                            </p>
                                        </div>
                                        <Button type="button" onClick={openCreate} className="shrink-0">
                                            <Plus className="h-4 w-4 me-2" />
                                            {t('Create Key')}
                                        </Button>
                                    </div>

                                    {loading ? (
                                        <TableSkeleton columns={skeletonColumns} rows={5} />
                                    ) : keys.length === 0 ? (
                                        <EmptyState
                                            variant="card"
                                            icon={<KeyRound className="h-12 w-12" />}
                                            title={t('No API keys yet')}
                                            description={t('Create your first API key to let external tools read your account data.')}
                                            action={
                                                <Button type="button" onClick={openCreate}>
                                                    <Plus className="h-4 w-4 me-2" />
                                                    {t('Create Key')}
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <TanStackDataTable
                                            columns={columns}
                                            data={keys}
                                            searchColumn="name"
                                            searchPlaceholder={t('Search keys...')}
                                        />
                                    )}
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <form onSubmit={handleCreate}>
                        <DialogHeader>
                            <DialogTitle>{t('Create API Key')}</DialogTitle>
                            <DialogDescription>
                                {t('Give the key a name and choose when it expires. The key grants read-only access to your account.')}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="key_name">{t('Key name')}</Label>
                                <Input
                                    id="key_name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t('e.g. CI script')}
                                />
                                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="key_expiry">{t('Expiration')}</Label>
                                <Select value={expiresIn} onValueChange={setExpiresIn}>
                                    <SelectTrigger id="key_expiry">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="never">{t('Never')}</SelectItem>
                                        <SelectItem value="30">{t('30 days')}</SelectItem>
                                        <SelectItem value="90">{t('90 days')}</SelectItem>
                                        <SelectItem value="365">{t('365 days')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.expires_in && (
                                    <p className="text-sm text-destructive">{errors.expires_in}</p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                                disabled={saving}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                {t('Create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <NewKeyDialog token={newToken} onClose={() => setNewToken(null)} />

            <AlertDialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('Are you sure you want to revoke this API key? Applications using it will stop working.')}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This action cannot be undone.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRevoke}
                            disabled={revokeTarget !== null && revokingId === revokeTarget.id}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {t('Revoke')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
