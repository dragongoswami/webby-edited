import { useEffect, useRef, useState } from 'react';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuSeparator,
} from '@/components/ui/table-action-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FileEdit,
    Trash2,
    Plus,
    Loader2,
    Search,
    Upload,
    X,
} from 'lucide-react';
import type { PageProps } from '@/types';

interface StockImage {
    id: number;
    filename: string;
    type: 'background' | 'gallery';
    subject: string;
    category: string;
    categories: string[];
    mood: string | null;
    tone: string;
    contrast: string;
    created_at: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedImages {
    data: StockImage[];
    current_page: number;
    from: number;
    last_page: number;
    links: PaginationLink[];
    per_page: number;
    to: number;
    total: number;
}

interface StockImagesPageProps extends PageProps {
    images: PaginatedImages;
    stats: { total: number; backgrounds: number; gallery: number };
    categories: string[];
}

const skeletonColumns: TableColumnConfig[] = [
    { type: 'text', width: 'w-12' },
    { type: 'text', width: 'w-48' },
    { type: 'text', width: 'w-24' },
    { type: 'text', width: 'w-32' },
    { type: 'text', width: 'w-20' },
    { type: 'text', width: 'w-20' },
    { type: 'actions', width: 'w-12' },
];

function getImageUrl(image: StockImage): string {
    const subdir = image.type === 'background' ? 'backgrounds' : 'gallery';
    return `/storage/image-library/${subdir}/${image.filename}`;
}

function CategoryInput({ id, value, onChange, categories, placeholder }: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    categories: string[];
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const filtered = categories.filter((cat) =>
        cat.toLowerCase().includes(value.toLowerCase())
    );

    return (
        <div className="relative">
            <Input
                id={id}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                autoComplete="off"
            />
            {open && value && filtered.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover p-1 shadow-md max-h-48 overflow-y-auto">
                    {filtered.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            className="w-full text-start rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(cat);
                                setOpen(false);
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Index() {
    const { images, categories, auth } = usePage<StockImagesPageProps>().props;
    const { t } = useTranslation();
    const { isLoading } = useAdminLoading();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingImage, setEditingImage] = useState<StockImage | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [imageToDelete, setImageToDelete] = useState<StockImage | null>(null);
    const [previewImage, setPreviewImage] = useState<StockImage | null>(null);
    const [searchValue, setSearchValue] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const createFileInputRef = useRef<HTMLInputElement>(null);
    const [createFileName, setCreateFileName] = useState<string | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { data: createData, setData: setCreateData, post: createPost, processing: createProcessing, errors: createErrors, reset: createReset } = useForm({
        image: null as File | null,
        type: 'gallery' as string,
        subject: '',
        category: '',
        categories: [] as string[],
        mood: '',
        tone: 'light',
        contrast: 'dark-text',
    });

    const { data: editData, setData: setEditData, post: editPost, processing: editProcessing, errors: editErrors } = useForm({
        category: '',
        categories: [] as string[],
        mood: '' as string,
        tone: '',
        contrast: '',
        _method: 'PUT' as const,
    });

    const applyFilters = (overrides: Record<string, string> = {}) => {
        const params: Record<string, string | number> = { page: 1 };
        const s = overrides.search ?? searchValue;
        const ty = overrides.type ?? typeFilter;
        const cat = overrides.category ?? categoryFilter;
        if (s) params.search = s;
        if (ty) params.type = ty;
        if (cat) params.category = cat;
        router.get(route('admin.stock-images'), params, { preserveState: true, preserveScroll: true });
    };

    const handleSearch = (value: string) => {
        setSearchValue(value);
        if (searchTimer.current) {
            clearTimeout(searchTimer.current);
        }
        searchTimer.current = setTimeout(() => {
            applyFilters({ search: value });
        }, 300);
    };

    useEffect(() => {
        return () => {
            if (searchTimer.current) {
                clearTimeout(searchTimer.current);
            }
        };
    }, []);

    const handleTypeFilter = (value: string) => {
        const v = value === 'all' ? '' : value;
        setTypeFilter(v);
        applyFilters({ type: v });
    };

    const handleCategoryFilter = (value: string) => {
        const v = value === 'all' ? '' : value;
        setCategoryFilter(v);
        applyFilters({ category: v });
    };

    const handlePageChange = (page: number) => {
        const params: Record<string, string | number> = { page: page + 1 };
        if (searchValue) params.search = searchValue;
        if (typeFilter) params.type = typeFilter;
        if (categoryFilter) params.category = categoryFilter;
        router.get(route('admin.stock-images'), params, { preserveState: true, preserveScroll: true });
    };

    const handlePageSizeChange = (size: number) => {
        const params: Record<string, string | number> = { per_page: size, page: 1 };
        if (searchValue) params.search = searchValue;
        if (typeFilter) params.type = typeFilter;
        if (categoryFilter) params.category = categoryFilter;
        router.get(route('admin.stock-images'), params, { preserveState: true, preserveScroll: true });
    };

    const openEditModal = (image: StockImage) => {
        setEditingImage(image);
        setEditData({
            category: image.category,
            categories: image.categories,
            mood: image.mood || '',
            tone: image.tone,
            contrast: image.contrast,
            _method: 'PUT',
        });
        setEditModalOpen(true);
    };

    const handleCreate = () => {
        createPost(route('admin.stock-images.store'), {
            forceFormData: true,
            onSuccess: () => {
                setCreateModalOpen(false);
                createReset();
                setCreateFileName(null);
                toast.success(t('Stock image added successfully'));
            },
            onError: (errs) => {
                const first = Object.values(errs)[0];
                if (first) toast.error(first);
            },
        });
    };

    const handleEdit = () => {
        if (!editingImage) return;
        editPost(route('admin.stock-images.update', editingImage.id), {
            onSuccess: () => {
                setEditModalOpen(false);
                setEditingImage(null);
                toast.success(t('Stock image updated successfully'));
            },
            onError: (errs) => {
                const first = Object.values(errs)[0];
                if (first) toast.error(first);
            },
        });
    };

    const handleDelete = () => {
        if (!imageToDelete) return;
        router.delete(route('admin.stock-images.destroy', imageToDelete.id), {
            onSuccess: () => {
                setDeleteDialogOpen(false);
                setImageToDelete(null);
                toast.success(t('Stock image deleted successfully'));
            },
        });
    };

    const columns: ColumnDef<StockImage>[] = [
        {
            accessorKey: 'thumbnail',
            header: '',
            cell: ({ row }) => (
                <button
                    type="button"
                    aria-label={t('Preview image')}
                    className="rounded transition-opacity hover:opacity-80"
                    onClick={() => setPreviewImage(row.original)}
                >
                    <img
                        src={getImageUrl(row.original)}
                        alt={row.original.subject}
                        className="h-10 w-10 rounded object-cover"
                        loading="lazy"
                    />
                </button>
            ),
            size: 48,
            enableSorting: false,
        },
        {
            accessorKey: 'subject',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Subject')} />,
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.subject}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-48">{row.original.filename}</div>
                </div>
            ),
        },
        {
            accessorKey: 'type',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Type')} />,
            cell: ({ row }) => (
                <Badge variant={row.original.type === 'background' ? 'default' : 'secondary'}>
                    {row.original.type === 'background' ? t('Background') : t('Gallery')}
                </Badge>
            ),
        },
        {
            accessorKey: 'category',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Category')} />,
            cell: ({ row }) => <span className="text-sm">{row.original.category}</span>,
        },
        {
            accessorKey: 'tone',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Tone')} />,
            cell: ({ row }) => <span className="text-sm">{row.original.tone}</span>,
        },
        {
            accessorKey: 'contrast',
            header: ({ column }) => <DataTableColumnHeader column={column} title={t('Contrast')} />,
            cell: ({ row }) => <span className="text-sm">{row.original.contrast}</span>,
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <TableActionMenu>
                    <TableActionMenuTrigger />
                    <TableActionMenuContent>
                        <TableActionMenuItem onClick={() => openEditModal(row.original)}>
                            <FileEdit className="me-2 h-4 w-4" /> {t('Edit')}
                        </TableActionMenuItem>
                        <TableActionMenuSeparator />
                        <TableActionMenuItem
                            variant="destructive"
                            onClick={() => { setImageToDelete(row.original); setDeleteDialogOpen(true); }}
                        >
                            <Trash2 className="me-2 h-4 w-4" /> {t('Delete')}
                        </TableActionMenuItem>
                    </TableActionMenuContent>
                </TableActionMenu>
            ),
            size: 48,
        },
    ];

    return (
        <AdminLayout user={auth.user!} title={t('Stock Images')}>
            <Head title={t('Stock Images')} />

            <AdminPageHeader
                title={t('Stock Images')}
                subtitle={t('Manage stock image library for AI builder')}
                action={
                    <Button onClick={() => setCreateModalOpen(true)}>
                        <Plus className="h-4 w-4 me-2" />
                        {t('Add Stock Image')}
                    </Button>
                }
            />

            <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('Search images...')}
                                value={searchValue}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="ps-9 w-full sm:w-[300px]"
                            />
                        </div>
                        <Select value={typeFilter || 'all'} onValueChange={handleTypeFilter}>
                            <SelectTrigger className="w-full sm:w-40">
                                <SelectValue placeholder={t('All Types')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Types')}</SelectItem>
                                <SelectItem value="background">{t('Background')}</SelectItem>
                                <SelectItem value="gallery">{t('Gallery')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={categoryFilter || 'all'} onValueChange={handleCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder={t('All Categories')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('All Categories')}</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Table */}
                {isLoading ? (
                    <TableSkeleton columns={skeletonColumns} rows={10} rowsOnly />
                ) : (
                    <TanStackDataTable
                        columns={columns}
                        data={images.data}
                        showSearch={false}
                        serverPagination={{
                            pageCount: images.last_page,
                            pageIndex: images.current_page - 1,
                            pageSize: images.per_page,
                            total: images.total,
                            onPageChange: handlePageChange,
                            onPageSizeChange: handlePageSizeChange,
                        }}
                    />
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('Add Stock Image')}</DialogTitle>
                        <DialogDescription>
                            {t('Upload an image file')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                        <div className="space-y-2">
                            <Label>{t('Image')} *</Label>
                            <input
                                ref={createFileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setCreateData('image', file);
                                        setCreateFileName(file.name);
                                    }
                                }}
                            />
                            <div className="flex items-center gap-3">
                                {createFileName ? (
                                    <>
                                        <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                                        <span className="text-sm flex-1 truncate">{createFileName}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => { setCreateData('image', null); setCreateFileName(null); }}
                                            aria-label={t('Remove')}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => createFileInputRef.current?.click()}
                                    >
                                        <Upload className="h-4 w-4 me-2" />
                                        {t('Upload an image file')}
                                    </Button>
                                )}
                            </div>
                            {createErrors.image && (
                                <p className="text-sm text-destructive">{createErrors.image}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create-type">{t('Type')} *</Label>
                            <Select value={createData.type} onValueChange={(v) => setCreateData('type', v)}>
                                <SelectTrigger id="create-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gallery">{t('Gallery')}</SelectItem>
                                    <SelectItem value="background">{t('Background')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create-subject">{t('Subject')} *</Label>
                            <Input
                                id="create-subject"
                                value={createData.subject}
                                onChange={(e) => setCreateData('subject', e.target.value)}
                                placeholder={t('e.g. golden-croissant')}
                            />
                            {createErrors.subject && (
                                <p className="text-sm text-destructive">{createErrors.subject}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create-category">{t('Category')} *</Label>
                            <CategoryInput
                                id="create-category"
                                value={createData.category}
                                onChange={(v) => {
                                    setCreateData('category', v);
                                    setCreateData('categories', v.split('-'));
                                }}
                                categories={categories}
                                placeholder={t('e.g. food-bakery')}
                            />
                            {createErrors.category && (
                                <p className="text-sm text-destructive">{createErrors.category}</p>
                            )}
                        </div>

                        {createData.type === 'background' && (
                            <div className="space-y-2">
                                <Label htmlFor="create-mood">{t('Mood')}</Label>
                                <Input
                                    id="create-mood"
                                    value={createData.mood}
                                    onChange={(e) => setCreateData('mood', e.target.value)}
                                    placeholder={t('e.g. warm')}
                                />
                                {createErrors.mood && (
                                    <p className="text-sm text-destructive">{createErrors.mood}</p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create-tone">{t('Tone')}</Label>
                                <Select value={createData.tone} onValueChange={(v) => setCreateData('tone', v)}>
                                    <SelectTrigger id="create-tone"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">{t('light')}</SelectItem>
                                        <SelectItem value="dark">{t('dark')}</SelectItem>
                                        <SelectItem value="warm">{t('warm')}</SelectItem>
                                        <SelectItem value="cool">{t('cool')}</SelectItem>
                                        <SelectItem value="neutral">{t('neutral')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {createErrors.tone && (
                                    <p className="text-sm text-destructive">{createErrors.tone}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="create-contrast">{t('Contrast')}</Label>
                                <Select value={createData.contrast} onValueChange={(v) => setCreateData('contrast', v)}>
                                    <SelectTrigger id="create-contrast"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dark-text">{t('dark-text')}</SelectItem>
                                        <SelectItem value="light-text">{t('light-text')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {createErrors.contrast && (
                                    <p className="text-sm text-destructive">{createErrors.contrast}</p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={createProcessing}>
                                {createProcessing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                {t('Add Stock Image')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('Edit Stock Image')}</DialogTitle>
                        <DialogDescription>{editingImage?.filename}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} className="space-y-4">
                        {editingImage && (
                            <img
                                src={getImageUrl(editingImage)}
                                alt={editingImage.subject}
                                className="w-full h-40 object-cover rounded-md"
                            />
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="edit-category">{t('Category')}</Label>
                            <CategoryInput
                                id="edit-category"
                                value={editData.category}
                                onChange={(v) => {
                                    setEditData('category', v);
                                    setEditData('categories', v.split('-'));
                                }}
                                categories={categories}
                            />
                            {editErrors.category && (
                                <p className="text-sm text-destructive">{editErrors.category}</p>
                            )}
                        </div>

                        {editingImage?.type === 'background' && (
                            <div className="space-y-2">
                                <Label htmlFor="edit-mood">{t('Mood')}</Label>
                                <Input
                                    id="edit-mood"
                                    value={editData.mood}
                                    onChange={(e) => setEditData('mood', e.target.value)}
                                    placeholder={t('e.g. warm')}
                                />
                                {editErrors.mood && (
                                    <p className="text-sm text-destructive">{editErrors.mood}</p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit-tone">{t('Tone')}</Label>
                                <Select value={editData.tone} onValueChange={(v) => setEditData('tone', v)}>
                                    <SelectTrigger id="edit-tone"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">{t('light')}</SelectItem>
                                        <SelectItem value="dark">{t('dark')}</SelectItem>
                                        <SelectItem value="warm">{t('warm')}</SelectItem>
                                        <SelectItem value="cool">{t('cool')}</SelectItem>
                                        <SelectItem value="neutral">{t('neutral')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {editErrors.tone && (
                                    <p className="text-sm text-destructive">{editErrors.tone}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-contrast">{t('Contrast')}</Label>
                                <Select value={editData.contrast} onValueChange={(v) => setEditData('contrast', v)}>
                                    <SelectTrigger id="edit-contrast"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dark-text">{t('dark-text')}</SelectItem>
                                        <SelectItem value="light-text">{t('light-text')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                {editErrors.contrast && (
                                    <p className="text-sm text-destructive">{editErrors.contrast}</p>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={editProcessing}>
                                {editProcessing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                {t('Save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Delete Stock Image')}</DialogTitle>
                        <DialogDescription>
                            {t('Are you sure you want to delete this stock image?')} {t('This action cannot be undone.')}
                        </DialogDescription>
                    </DialogHeader>
                    {imageToDelete && (
                        <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
                            <img
                                src={getImageUrl(imageToDelete)}
                                alt={imageToDelete.subject}
                                className="h-12 w-12 rounded object-cover"
                            />
                            <div>
                                <div className="font-medium text-sm">{imageToDelete.subject}</div>
                                <div className="text-xs text-muted-foreground">{imageToDelete.filename}</div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t('Cancel')}</Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            {t('Delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Preview */}
            <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
                <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
                    {previewImage && (
                        <>
                            <img
                                src={getImageUrl(previewImage)}
                                alt={previewImage.subject}
                                className="w-full max-h-[70vh] object-contain bg-muted"
                            />
                            <div className="p-4 space-y-1">
                                <p className="font-medium">{previewImage.subject}</p>
                                <p className="text-sm text-muted-foreground">{previewImage.filename}</p>
                                <div className="flex items-center gap-2 pt-1">
                                    <Badge variant={previewImage.type === 'background' ? 'default' : 'secondary'}>
                                        {previewImage.type}
                                    </Badge>
                                    <Badge variant="outline">{previewImage.category}</Badge>
                                    <Badge variant="outline">{previewImage.tone}</Badge>
                                    <Badge variant="outline">{previewImage.contrast}</Badge>
                                    {previewImage.mood && <Badge variant="outline">{previewImage.mood}</Badge>}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
