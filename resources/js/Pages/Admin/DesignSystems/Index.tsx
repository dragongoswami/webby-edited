import { useState, useRef } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useForm } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { AdminPageHeader } from '@/components/Admin/AdminPageHeader';
import { TanStackDataTable } from '@/components/Admin/TanStackDataTable';
import { useAdminLoading } from '@/hooks/useAdminLoading';
import { TableSkeleton, TableColumnConfig } from '@/components/Admin/skeletons';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuSeparator,
} from '@/components/ui/table-action-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
    FileEdit,
    Trash2,
    Plus,
    Loader2,
    Upload,
    File,
    X,
    Eye,
} from 'lucide-react';
import { DesignSystemThumbnail } from '@/components/Design/DesignSystemThumbnail';
import { DesignSystemPreviewModal } from '@/components/Design/DesignSystemPreviewModal';
import type { PageProps } from '@/types';

interface DesignSystem {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    when_to_use: string | null;
    version: string | null;
    author: string | null;
    is_default: boolean;
    status: 'active' | 'inactive';
    has_preview?: boolean;
    created_at: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedDesignSystems {
    data: DesignSystem[];
    current_page: number;
    from: number;
    last_page: number;
    links: PaginationLink[];
    per_page: number;
    to: number;
    total: number;
}

interface DesignSystemsPageProps extends PageProps {
    designSystems: PaginatedDesignSystems;
}

// Skeleton column configuration for Design Systems table
const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-64' },     // Design System (name + description)
    { type: 'text', width: 'w-32' },     // Slug
    { type: 'text', width: 'w-20' },     // Version
    { type: 'text', width: 'w-32' },     // Status
    { type: 'actions', width: 'w-12' },  // Actions
];

export default function Index() {
    const { designSystems, auth } = usePage<DesignSystemsPageProps>().props;
    const { t } = useTranslation();
    const { isLoading } = useAdminLoading();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingDesignSystem, setEditingDesignSystem] = useState<DesignSystem | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [designSystemToDelete, setDesignSystemToDelete] = useState<DesignSystem | null>(null);
    const [previewSystem, setPreviewSystem] = useState<DesignSystem | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const openPreview = (s: DesignSystem) => { setPreviewSystem(s); setPreviewOpen(true); };

    // File upload refs and state
    const createZipInputRef = useRef<HTMLInputElement>(null);
    const editZipInputRef = useRef<HTMLInputElement>(null);
    const [createZipFileName, setCreateZipFileName] = useState<string | null>(null);
    const [editZipFileName, setEditZipFileName] = useState<string | null>(null);

    // Create form
    const { data: createData, setData: setCreateData, post: createPost, processing: createProcessing, errors: createErrors, reset: createReset } = useForm({
        name: '',
        description: '',
        when_to_use: '',
        zip_file: null as File | null,
        is_default: false,
    });

    // Edit form
    const { data: editData, setData: setEditData, post: editPost, processing: editProcessing, errors: editErrors } = useForm({
        name: '',
        description: '',
        when_to_use: '',
        zip_file: null as File | null,
        is_default: false,
        status: 'active' as 'active' | 'inactive',
        _method: 'PUT' as const,
    });

    const handlePageChange = (page: number) => {
        router.get(
            route('admin.design-systems'),
            { page: page + 1 },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handlePageSizeChange = (size: number) => {
        router.get(
            route('admin.design-systems'),
            { per_page: size, page: 1 },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleDeleteConfirm = () => {
        if (designSystemToDelete) {
            router.delete(route('admin.design-systems.destroy', designSystemToDelete.id), {
                onSuccess: () => {
                    setDeleteDialogOpen(false);
                    setDesignSystemToDelete(null);
                    toast.success(t('Design system deleted successfully'));
                },
                onError: () => toast.error(t('Failed to delete design system')),
            });
        }
    };

    const openCreateModal = () => setCreateModalOpen(true);
    const closeCreateModal = () => {
        setCreateModalOpen(false);
        createReset();
        setCreateZipFileName(null);
    };

    const openEditModal = (designSystem: DesignSystem) => {
        setEditingDesignSystem(designSystem);
        setEditData({
            name: designSystem.name,
            description: designSystem.description ?? '',
            when_to_use: designSystem.when_to_use ?? '',
            zip_file: null,
            is_default: designSystem.is_default,
            status: designSystem.status,
            _method: 'PUT',
        });
        setEditModalOpen(true);
    };

    const closeEditModal = () => {
        setEditModalOpen(false);
        setEditingDesignSystem(null);
        setEditZipFileName(null);
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createPost(route('admin.design-systems.store'), {
            forceFormData: true,
            onSuccess: () => {
                closeCreateModal();
                toast.success(t('Design system created successfully'));
            },
            onError: () => toast.error(t('Failed to create design system')),
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDesignSystem) return;
        editPost(route('admin.design-systems.update', editingDesignSystem.id), {
            forceFormData: true,
            onSuccess: () => {
                closeEditModal();
                toast.success(t('Design system updated successfully'));
            },
            onError: () => toast.error(t('Failed to update design system')),
        });
    };

    const columns: ColumnDef<DesignSystem>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Design System')} />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    {row.original.has_preview ? (
                        <button
                            type="button"
                            onClick={() => openPreview(row.original)}
                            className="group relative w-24 shrink-0 overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title={t('Preview :name', { name: t(row.original.name) })}
                            aria-label={t('Preview :name', { name: t(row.original.name) })}
                        >
                            <DesignSystemThumbnail
                                slug={row.original.slug}
                                name={t(row.original.name)}
                                hasPreview
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-background/0 text-transparent transition-colors group-hover:bg-background/60 group-hover:text-foreground">
                                <Eye className="h-4 w-4" />
                            </span>
                        </button>
                    ) : (
                        <DesignSystemThumbnail
                            slug={row.original.slug}
                            name={t(row.original.name)}
                            hasPreview={false}
                            className="w-24 shrink-0"
                        />
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{t(row.original.name)}</span>
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                            {row.original.description}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'slug',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Slug')} />
            ),
            cell: ({ row }) => (
                <code className="text-sm text-muted-foreground">{row.original.slug}</code>
            ),
        },
        {
            accessorKey: 'version',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Version')} />
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">{row.original.version || '—'}</span>
            ),
        },
        {
            id: 'badges',
            header: () => <span className="text-xs">{t('Status')}</span>,
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.is_default && (
                        <Badge variant="secondary" className="text-xs">
                            {t('Default')}
                        </Badge>
                    )}
                    <Badge
                        variant={row.original.status === 'active' ? 'default' : 'outline'}
                        className="text-xs"
                    >
                        {row.original.status === 'active' ? t('Active') : t('Inactive')}
                    </Badge>
                </div>
            ),
        },
        {
            id: 'actions',
            enableHiding: false,
            cell: ({ row }) => {
                const designSystem = row.original;
                return (
                    <TableActionMenu>
                        <TableActionMenuTrigger />
                        <TableActionMenuContent>
                            {designSystem.has_preview && (
                                <TableActionMenuItem onClick={() => openPreview(designSystem)}>
                                    <Eye className="me-2 h-4 w-4" />
                                    {t('Preview')}
                                </TableActionMenuItem>
                            )}
                            <TableActionMenuItem onClick={() => openEditModal(designSystem)}>
                                <FileEdit className="me-2 h-4 w-4" />
                                {t('Edit')}
                            </TableActionMenuItem>
                            <TableActionMenuSeparator />
                            <TableActionMenuItem
                                variant="destructive"
                                disabled={designSystem.is_default}
                                className={designSystem.is_default ? 'opacity-50 cursor-not-allowed' : ''}
                                onClick={() => {
                                    if (!designSystem.is_default) {
                                        setDesignSystemToDelete(designSystem);
                                        setDeleteDialogOpen(true);
                                    }
                                }}
                            >
                                <Trash2 className="me-2 h-4 w-4" />
                                {t('Delete')}
                            </TableActionMenuItem>
                        </TableActionMenuContent>
                    </TableActionMenu>
                );
            },
        },
    ];

    if (isLoading) {
        return (
            <AdminLayout user={auth.user!} title={t('Design Systems')}>
                <AdminPageHeader
                    title={t('Design Systems')}
                    subtitle={t('Manage design systems for AI projects')}
                />
                <TableSkeleton columns={skeletonColumns} rows={10} showSearch={false} filterCount={0} />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout user={auth.user!} title={t('Design Systems')}>
            <Head title={t('Design Systems')} />

            <AdminPageHeader
                title={t('Design Systems')}
                subtitle={t('Manage design systems for AI projects')}
                action={
                    <Button onClick={openCreateModal}>
                        <Plus className="h-4 w-4 me-2" />
                        {t('Add Design System')}
                    </Button>
                }
            />

            <div className="space-y-4">
                {/* Table */}
                <TanStackDataTable
                    columns={columns}
                    data={designSystems.data}
                    showSearch={false}
                    serverPagination={{
                        pageCount: designSystems.last_page,
                        pageIndex: designSystems.current_page - 1,
                        pageSize: designSystems.per_page,
                        total: designSystems.total,
                        onPageChange: handlePageChange,
                        onPageSizeChange: handlePageSizeChange,
                    }}
                />
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('Delete Design System')}</DialogTitle>
                        <DialogDescription>
                            {designSystemToDelete?.is_default ? (
                                <span className="text-destructive font-medium">
                                    {t('The default design system cannot be deleted.')}
                                </span>
                            ) : (
                                <>{t('Are you sure you want to delete ":name"? This action cannot be undone.', { name: designSystemToDelete?.name || '' })}</>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {!designSystemToDelete?.is_default && (
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                {t('Cancel')}
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteConfirm}>
                                {t('Delete Design System')}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Create Modal */}
            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('Add Design System')}</DialogTitle>
                        <DialogDescription>
                            {t('Upload a new design system for AI projects')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="space-y-4">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="create-name">{t('Name')} *</Label>
                            <Input
                                id="create-name"
                                value={createData.name}
                                onChange={(e) => setCreateData('name', e.target.value)}
                                placeholder={t('e.g. Minimal, Brutalist, Glassmorphism')}
                                required
                            />
                            {createErrors.name && (
                                <p className="text-sm text-destructive">{createErrors.name}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="create-description">{t('Description')}</Label>
                            <Textarea
                                id="create-description"
                                value={createData.description}
                                onChange={(e) => setCreateData('description', e.target.value)}
                                placeholder={t('Brief description of this design system')}
                                rows={2}
                            />
                            {createErrors.description && (
                                <p className="text-sm text-destructive">{createErrors.description}</p>
                            )}
                        </div>

                        {/* When to use */}
                        <div className="space-y-2">
                            <Label htmlFor="create-when-to-use">{t('When to Use')}</Label>
                            <Textarea
                                id="create-when-to-use"
                                value={createData.when_to_use}
                                onChange={(e) => setCreateData('when_to_use', e.target.value)}
                                placeholder={t('When the AI should auto-select this system')}
                                rows={2}
                            />
                            {createErrors.when_to_use && (
                                <p className="text-sm text-destructive">{createErrors.when_to_use}</p>
                            )}
                        </div>

                        {/* ZIP File */}
                        <div className="space-y-2">
                            <Label>{t('Design System ZIP File')} *</Label>
                            <div className="flex items-center gap-3">
                                {createZipFileName ? (
                                    <>
                                        <File className="h-5 w-5 text-muted-foreground shrink-0" />
                                        <span className="text-sm flex-1 truncate">{createZipFileName}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                setCreateZipFileName(null);
                                                setCreateData('zip_file', null);
                                            }}
                                            aria-label={t('Remove')}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            ref={createZipInputRef}
                                            type="file"
                                            accept=".zip"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setCreateZipFileName(file.name);
                                                    setCreateData('zip_file', file);
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => createZipInputRef.current?.click()}
                                        >
                                            <Upload className="h-4 w-4 me-2" />
                                            {t('Choose ZIP File')}
                                        </Button>
                                        <span className="text-xs text-muted-foreground">{t('Max 10MB')}</span>
                                    </>
                                )}
                            </div>
                            {createErrors.zip_file && (
                                <p className="text-sm text-destructive">{createErrors.zip_file}</p>
                            )}
                        </div>

                        {/* Flags */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="create-is-default"
                                    checked={createData.is_default}
                                    onCheckedChange={(checked) => setCreateData('is_default', checked === true)}
                                />
                                <Label htmlFor="create-is-default" className="text-sm font-normal cursor-pointer">
                                    {t('Set as default design system')}
                                </Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeCreateModal}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={createProcessing}>
                                {createProcessing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                        {t('Uploading...')}
                                    </>
                                ) : (
                                    t('Upload Design System')
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('Edit Design System')}</DialogTitle>
                        <DialogDescription>
                            {t('Update design system details and files')}
                        </DialogDescription>
                    </DialogHeader>
                    {editingDesignSystem && (
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">{t('Name')} *</Label>
                                <Input
                                    id="edit-name"
                                    value={editData.name}
                                    onChange={(e) => setEditData('name', e.target.value)}
                                    placeholder={t('e.g. Minimal, Brutalist, Glassmorphism')}
                                    required
                                />
                                {editErrors.name && (
                                    <p className="text-sm text-destructive">{editErrors.name}</p>
                                )}
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="edit-description">{t('Description')}</Label>
                                <Textarea
                                    id="edit-description"
                                    value={editData.description}
                                    onChange={(e) => setEditData('description', e.target.value)}
                                    placeholder={t('Brief description of this design system')}
                                    rows={2}
                                />
                                {editErrors.description && (
                                    <p className="text-sm text-destructive">{editErrors.description}</p>
                                )}
                            </div>

                            {/* When to use */}
                            <div className="space-y-2">
                                <Label htmlFor="edit-when-to-use">{t('When to Use')}</Label>
                                <Textarea
                                    id="edit-when-to-use"
                                    value={editData.when_to_use}
                                    onChange={(e) => setEditData('when_to_use', e.target.value)}
                                    placeholder={t('When the AI should auto-select this system')}
                                    rows={2}
                                />
                                {editErrors.when_to_use && (
                                    <p className="text-sm text-destructive">{editErrors.when_to_use}</p>
                                )}
                            </div>

                            {/* ZIP File */}
                            <div className="space-y-2">
                                <Label>{t('Design System ZIP File')}</Label>
                                <div className="flex items-center gap-3">
                                    {editZipFileName ? (
                                        <>
                                            <File className="h-5 w-5 text-muted-foreground shrink-0" />
                                            <span className="text-sm flex-1 truncate">{editZipFileName}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    setEditZipFileName(null);
                                                    setEditData('zip_file', null);
                                                }}
                                                aria-label={t('Remove')}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                ref={editZipInputRef}
                                                type="file"
                                                accept=".zip"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setEditZipFileName(file.name);
                                                        setEditData('zip_file', file);
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => editZipInputRef.current?.click()}
                                            >
                                                <Upload className="h-4 w-4 me-2" />
                                                {t('Choose ZIP File')}
                                            </Button>
                                            <span className="text-xs text-muted-foreground">{t('Leave empty to keep current')}</span>
                                        </>
                                    )}
                                </div>
                                {editErrors.zip_file && (
                                    <p className="text-sm text-destructive">{editErrors.zip_file}</p>
                                )}
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <Label htmlFor="edit-status">{t('Status')}</Label>
                                <Select
                                    value={editData.status}
                                    onValueChange={(value) => setEditData('status', value as 'active' | 'inactive')}
                                >
                                    <SelectTrigger id="edit-status">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">{t('Active')}</SelectItem>
                                        <SelectItem value="inactive">{t('Inactive')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {editErrors.status && (
                                    <p className="text-sm text-destructive">{editErrors.status}</p>
                                )}
                            </div>

                            {/* Flags */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="edit-is-default"
                                        checked={editData.is_default}
                                        onCheckedChange={(checked) => setEditData('is_default', checked === true)}
                                    />
                                    <Label htmlFor="edit-is-default" className="text-sm font-normal cursor-pointer">
                                        {t('Set as default design system')}
                                    </Label>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeEditModal}>
                                    {t('Cancel')}
                                </Button>
                                <Button type="submit" disabled={editProcessing}>
                                    {editProcessing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                            {t('Saving...')}
                                        </>
                                    ) : (
                                        t('Save Changes')
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {previewSystem && (
                <DesignSystemPreviewModal
                    slug={previewSystem.slug}
                    name={t(previewSystem.name)}
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                />
            )}
        </AdminLayout>
    );
}
