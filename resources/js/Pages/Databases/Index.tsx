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
import { SupabaseSetupGuide } from '@/components/Databases/SupabaseSetupGuide';
import { EmptyState } from '@/components/ui/empty-state';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuLabel,
    TableActionMenuSeparator,
} from '@/components/ui/table-action-menu';
import {
    Plus,
    Trash2,
    Check,
    Loader2,
    Zap,
    Database,
    Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';
import type { User } from '@/types';

interface Connection {
    id: number;
    label: string;
    url: string;
    publishable_key: string | null;
    has_secret_key: boolean;
    has_db_connection: boolean;
    last_tested_at: string | null;
}

interface FormState {
    label: string;
    url: string;
    publishable_key: string;
    secret_key: string;
    db_connection: string;
}

interface DatabasesPageProps {
    auth: {
        user: User;
    };
}

const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-48' },
    { type: 'text', width: 'w-64' },
    { type: 'badge', width: 'w-40' },
    { type: 'date', width: 'w-32' },
    { type: 'actions', width: 'w-12' },
];

const EMPTY_FORM: FormState = {
    label: '',
    url: '',
    publishable_key: '',
    secret_key: '',
    db_connection: '',
};

export default function DatabasesIndex({ auth }: DatabasesPageProps) {
    const user = auth.user;
    const { t } = useTranslation();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Connection | null>(null);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);

    const loadConnections = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(route('supabase-connections.index'));
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

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (connection: Connection) => {
        setEditing(connection);
        setForm({
            label: connection.label,
            url: connection.url,
            publishable_key: connection.publishable_key ?? '',
            secret_key: '',
            db_connection: '',
        });
        setErrors({});
        setDialogOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setErrors({});

        try {
            if (editing) {
                await axios.put(route('supabase-connections.update', editing.id), form);
            } else {
                await axios.post(route('supabase-connections.store'), form);
            }
            toast.success(t('Connection saved'));
            setDialogOpen(false);
            await loadConnections();
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
                const validationErrors = error.response.data.errors ?? {};
                const flattened: Record<string, string> = {};
                Object.entries(validationErrors).forEach(([key, messages]) => {
                    flattened[key] = Array.isArray(messages) ? messages[0] : String(messages);
                });
                setErrors(flattened);
            } else {
                toast.error(t('Failed to save connection'));
            }
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async (connection: Connection) => {
        setTestingId(connection.id);
        try {
            const response = await axios.post(route('supabase-connections.test', connection.id));
            if (response.data.ok) {
                toast.success(response.data.message || t('Connection successful!'));
                await loadConnections();
            } else {
                toast.error(response.data.message || t('Connection failed'));
            }
        } catch {
            toast.error(t('Failed to test connection'));
        } finally {
            setTestingId(null);
        }
    };

    const handleDelete = (connection: Connection) => {
        setDeleteTarget(connection);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const connection = deleteTarget;
        setDeletingId(connection.id);
        try {
            await axios.delete(route('supabase-connections.destroy', connection.id));
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
            accessorKey: 'label',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Name')} />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{row.original.label}</span>
                </div>
            ),
        },
        {
            accessorKey: 'url',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Supabase URL')} />
            ),
            cell: ({ row }) => (
                <span className="font-mono text-xs text-muted-foreground truncate block max-w-[260px]">
                    {row.original.url}
                </span>
            ),
        },
        {
            id: 'status',
            enableSorting: false,
            header: () => t('Status'),
            cell: ({ row }) => {
                const connection = row.original;
                return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {connection.has_secret_key && (
                            <Badge variant="outline" className="gap-1">
                                <Check className="h-3 w-3" />
                                {t('Secret saved')}
                            </Badge>
                        )}
                        {connection.has_db_connection && (
                            <Badge variant="outline" className="gap-1">
                                <Check className="h-3 w-3" />
                                {t('Database link saved')}
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'last_tested_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Last tested')} />
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.original.last_tested_at ? formatDate(row.original.last_tested_at) : '—'}
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
                                onClick={() => handleTest(connection)}
                                disabled={testingId === connection.id}
                            >
                                {testingId === connection.id ? (
                                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                ) : (
                                    <Zap className="h-4 w-4 me-2" />
                                )}
                                {t('Test Connection')}
                            </TableActionMenuItem>
                            <TableActionMenuItem onClick={() => openEdit(connection)}>
                                <Pencil className="h-4 w-4 me-2" />
                                {t('Edit')}
                            </TableActionMenuItem>
                            <TableActionMenuSeparator />
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
                                {t('Delete')}
                            </TableActionMenuItem>
                        </TableActionMenuContent>
                    </TableActionMenu>
                );
            },
        },
    ];

    return (
        <>
            <Head title={t('Databases')} />
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
                                                {t('Databases')}
                                            </h1>
                                            <p className="text-muted-foreground mt-1">
                                                {t('Attach your own Supabase database to projects you create. Keys are encrypted and stored securely.')}
                                            </p>
                                        </div>
                                        <Button type="button" onClick={openCreate} className="shrink-0">
                                            <Plus className="h-4 w-4 me-2" />
                                            {t('Add Connection')}
                                        </Button>
                                    </div>

                                    {/* Connections table */}
                                    {loading ? (
                                        <TableSkeleton columns={skeletonColumns} rows={5} />
                                    ) : connections.length === 0 ? (
                                        <EmptyState
                                            variant="card"
                                            icon={<Database className="h-12 w-12" />}
                                            title={t('No database connections yet')}
                                            description={t('Add a Supabase connection to attach your own database to a project.')}
                                            action={
                                                <Button type="button" onClick={openCreate}>
                                                    <Plus className="h-4 w-4 me-2" />
                                                    {t('Add Connection')}
                                                </Button>
                                            }
                                        />
                                    ) : (
                                        <TanStackDataTable
                                            columns={columns}
                                            data={connections}
                                            searchColumn="label"
                                            searchPlaceholder={t('Search connections...')}
                                        />
                                    )}
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>
                                {editing ? t('Edit Connection') : t('Add Connection')}
                            </DialogTitle>
                            <DialogDescription>
                                {t("Enter your Supabase project's connection details below.")}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="pt-3">
                            <SupabaseSetupGuide />
                        </div>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="conn_label">{t('Connection name')}</Label>
                                <Input
                                    id="conn_label"
                                    value={form.label}
                                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                                    placeholder={t('My Supabase project')}
                                />
                                {errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="conn_url">{t('Supabase URL')}</Label>
                                <Input
                                    id="conn_url"
                                    value={form.url}
                                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                                    placeholder="https://xxxx.supabase.co"
                                />
                                {errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="conn_publishable">{t('Publishable Key')}</Label>
                                <Input
                                    id="conn_publishable"
                                    value={form.publishable_key}
                                    onChange={(e) => setForm({ ...form, publishable_key: e.target.value })}
                                    placeholder="sb_publishable_..."
                                />
                                {errors.publishable_key && (
                                    <p className="text-sm text-destructive">{errors.publishable_key}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="conn_secret">{t('Secret Key')}</Label>
                                <Input
                                    id="conn_secret"
                                    type="password"
                                    value={form.secret_key}
                                    onChange={(e) => setForm({ ...form, secret_key: e.target.value })}
                                    placeholder={editing ? t('Leave blank to keep existing') : 'sb_secret_...'}
                                />
                                {errors.secret_key && (
                                    <p className="text-sm text-destructive">{errors.secret_key}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="conn_db">{t('DB Connection String')}</Label>
                                <Input
                                    id="conn_db"
                                    type="password"
                                    value={form.db_connection}
                                    onChange={(e) => setForm({ ...form, db_connection: e.target.value })}
                                    placeholder={editing ? t('Leave blank to keep existing') : 'postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres'}
                                />
                                {errors.db_connection && (
                                    <p className="text-sm text-destructive">{errors.db_connection}</p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                disabled={saving}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                {t('Save')}
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
                            {t('Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
