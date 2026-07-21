import { useState, useEffect, useCallback } from 'react';
import { Head, Link } from '@inertiajs/react';
import { usePageLoading } from '@/hooks/usePageLoading';
import { useTranslation } from '@/contexts/LanguageContext';
import { FileManagerSkeleton } from './FileManagerSkeleton';
import { FileGridSkeleton } from '@/components/skeletons';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { AppPageHeader } from '@/components/Header/AppPageHeader';
import { FileUploadZone, FileGrid, FilePreviewModal } from '@/components/FileManager';
import { EmptyState } from '@/components/ui/empty-state';
import {
    Files,
    Upload,
    ArrowUpCircle,
    FolderOpen,
    AlertCircle,
    Trash2,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import type { FileManagerPageProps as StoragePageProps, ProjectFile, StorageUsage, Pagination } from '@/types/storage';
import type { User } from '@/types';

interface FileManagerPageProps extends StoragePageProps {
    auth: {
        user: User;
    };
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function FileManagerIndex({ auth, projects: initialProjects, storageUsage: initialStorageUsage, planLimits }: FileManagerPageProps) {
    const user = auth.user;
    const { isLoading: isPageLoading } = usePageLoading();
    const { t } = useTranslation();

    const [projects, setProjects] = useState(initialProjects);
    const [storageUsage, setStorageUsage] = useState<StorageUsage>(initialStorageUsage);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        projects.length > 0 ? projects[0].id : null
    );
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
    const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    // Fetch files when project changes
    useEffect(() => {
        if (!selectedProjectId) {
            setFiles([]);
            setPagination(null);
            return;
        }

        const fetchFiles = async () => {
            setLoading(true);
            try {
                const response = await axios.get<{ files: ProjectFile[]; storage_used: number; pagination: Pagination }>(
                    `/project/${selectedProjectId}/files`,
                    { params: { per_page: 24 } }
                );
                setFiles(response.data.files);
                setPagination(response.data.pagination);
            } catch {
                toast.error(t('Failed to load files'));
            } finally {
                setLoading(false);
            }
        };

        fetchFiles();
        setSelectedIds(new Set());
    }, [selectedProjectId, t]);

    const loadMore = useCallback(async () => {
        if (!selectedProjectId || !pagination?.has_more || loadingMore) return;

        setLoadingMore(true);
        try {
            const response = await axios.get<{ files: ProjectFile[]; storage_used: number; pagination: Pagination }>(
                `/project/${selectedProjectId}/files`,
                { params: { per_page: 24, page: pagination.current_page + 1 } }
            );
            setFiles(prev => [...prev, ...response.data.files]);
            setPagination(response.data.pagination);
        } catch {
            toast.error(t('Failed to load more files'));
        } finally {
            setLoadingMore(false);
        }
    }, [selectedProjectId, pagination, loadingMore, t]);

    const handleProjectChange = (projectId: string) => {
        setSelectedProjectId(projectId);
    };

    const handleUploadComplete = useCallback((file: ProjectFile) => {
        setFiles(prev => [file, ...prev]);
        // Update project file count
        setProjects(prev => prev.map(p =>
            p.id === selectedProjectId
                ? { ...p, files_count: p.files_count + 1, storage_used: p.storage_used + file.size }
                : p
        ));
    }, [selectedProjectId]);

    const handleStorageUpdate = useCallback((bytesUsed: number) => {
        setStorageUsage(prev => ({
            ...prev,
            used_bytes: bytesUsed,
            used_mb: bytesUsed / (1024 * 1024),
            remaining_bytes: prev.unlimited ? Infinity : Math.max(0, (prev.limit_mb || 0) * 1024 * 1024 - bytesUsed),
            percentage: prev.unlimited ? 0 : ((bytesUsed / ((prev.limit_mb || 1) * 1024 * 1024)) * 100),
        }));
    }, []);

    const handleSelect = useCallback((id: number, selected: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(id);
            } else {
                next.delete(id);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((selected: boolean) => {
        if (selected) {
            setSelectedIds(new Set(files.map(f => f.id)));
        } else {
            setSelectedIds(new Set());
        }
    }, [files]);

    const handleDelete = useCallback(async (id: number) => {
        if (!selectedProjectId) return;

        setDeletingIds(prev => new Set(prev).add(id));

        try {
            const response = await axios.delete<{ storage_used: number }>(
                `/project/${selectedProjectId}/files/${id}`
            );

            const deletedFile = files.find(f => f.id === id);

            setFiles(prev => prev.filter(f => f.id !== id));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });

            // Update storage usage
            handleStorageUpdate(response.data.storage_used);

            // Update project file count
            if (deletedFile) {
                setProjects(prev => prev.map(p =>
                    p.id === selectedProjectId
                        ? { ...p, files_count: Math.max(0, p.files_count - 1), storage_used: Math.max(0, p.storage_used - deletedFile.size) }
                        : p
                ));
            }

            toast.success(t('File deleted'));
        } catch {
            toast.error(t('Failed to delete file'));
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [selectedProjectId, files, handleStorageUpdate, t]);

    const handleBulkDelete = useCallback(async () => {
        if (selectedIds.size === 0 || !selectedProjectId) return;

        const idsToDelete = Array.from(selectedIds);
        let lastStorageUsed = storageUsage.used_bytes;
        let successCount = 0;

        for (const id of idsToDelete) {
            setDeletingIds(prev => new Set(prev).add(id));

            try {
                const response = await axios.delete<{ storage_used: number }>(
                    `/project/${selectedProjectId}/files/${id}`
                );
                lastStorageUsed = response.data.storage_used;
                successCount++;

                const deletedFile = files.find(f => f.id === id);

                setFiles(prev => prev.filter(f => f.id !== id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });

                // Update project file count
                if (deletedFile) {
                    setProjects(prev => prev.map(p =>
                        p.id === selectedProjectId
                            ? { ...p, files_count: Math.max(0, p.files_count - 1), storage_used: Math.max(0, p.storage_used - deletedFile.size) }
                            : p
                    ));
                }
            } catch {
                // Continue with others
            } finally {
                setDeletingIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }
        }

        handleStorageUpdate(lastStorageUsed);

        // Report what actually succeeded, not what was requested.
        if (successCount === idsToDelete.length) {
            toast.success(t('Deleted :count files', { count: successCount }));
        } else if (successCount > 0) {
            toast.warning(t('Deleted :count of :total files', { count: successCount, total: idsToDelete.length }));
        } else {
            toast.error(t('Failed to delete files'));
        }
    }, [selectedIds, selectedProjectId, files, storageUsage.used_bytes, handleStorageUpdate, t]);

    const handlePreview = useCallback((file: ProjectFile) => {
        setPreviewFile(file);
    }, []);

    // If file storage is not enabled
    if (!planLimits.file_storage_enabled) {
        return (
            <>
                <Head title={t('File Manager')} />

                <TooltipProvider>
                    <SidebarProvider>
                        <AppSidebar user={user} />
                        <SidebarInset>
                            <div className="min-h-screen bg-background">
                                <AppPageHeader user={user} />

                                {/* Main Content */}
                                <main className="p-4 md:p-6 lg:p-8">
                                    <div className="max-w-7xl mx-auto">
                                        <EmptyState
                                            variant="card"
                                            icon={<AlertCircle className="h-16 w-16" />}
                                            title={t('File Storage Not Available')}
                                            description={t('Your current plan does not include file storage. Upgrade your plan to enable file uploads for your projects.')}
                                            action={
                                                <Link
                                                    href="/billing/plans"
                                                    className="inline-flex items-center gap-2 text-primary hover:underline"
                                                >
                                                    <ArrowUpCircle className="h-4 w-4" />
                                                    {t('View Plans')}
                                                </Link>
                                            }
                                        />
                                    </div>
                                </main>
                            </div>
                        </SidebarInset>
                    </SidebarProvider>
                </TooltipProvider>
            </>
        );
    }

    return (
        <>
            <Head title={t('File Manager')} />

            <TooltipProvider>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset>
                        <div className="min-h-screen bg-background">
                            <AppPageHeader user={user} />

                            {/* Main Content */}
                            <main className="p-4 md:p-6 lg:p-8">
                                {isPageLoading ? (
                                    <FileManagerSkeleton />
                                ) : (
                                <div className="max-w-7xl mx-auto">
                                    {/* Page Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                                        <div>
                                            <h1 className="text-2xl font-bold text-foreground">
                                                {t('File Manager')}
                                            </h1>
                                            <p className="text-muted-foreground mt-1">
                                                {t('Manage your project files')}
                                            </p>
                                        </div>

                                        {projects.length > 0 && (
                                            <Select value={selectedProjectId || undefined} onValueChange={handleProjectChange}>
                                                <SelectTrigger className="w-full sm:w-[280px]">
                                                    <FolderOpen className="h-4 w-4 me-2 shrink-0 text-muted-foreground" />
                                                    <span className="truncate">
                                                        <SelectValue placeholder={t('Select a project')} />
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {projects.map((project) => (
                                                        <SelectItem key={project.id} value={project.id}>
                                                            {project.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>

                                    {/* Projects List or File Browser */}
                                    {projects.length === 0 ? (
                                        <EmptyState
                                            variant="card"
                                            icon={<Files className="h-16 w-16" />}
                                            title={t('No projects yet')}
                                            description={t('Create a project to start uploading files')}
                                            action={
                                                <Link
                                                    href="/create"
                                                    className="inline-flex items-center gap-2 text-primary hover:underline"
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    {t('Create a Project')}
                                                </Link>
                                            }
                                        />
                                    ) : selectedProject ? (
                                        <Card>
                                            <CardHeader>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <CardTitle className="text-base truncate">{selectedProject.name}</CardTitle>
                                                        <CardDescription>
                                                            {t(':count files', { count: selectedProject.files_count })} &bull; {formatBytes(storageUsage.used_bytes)} {t('Used')}
                                                            {storageUsage.unlimited ? (
                                                                <Badge variant="secondary" className="ms-2">{t('Unlimited')}</Badge>
                                                            ) : (
                                                                ` ${t('of :limit MB', { limit: storageUsage.limit_mb ?? 0 })}`
                                                            )}
                                                        </CardDescription>
                                                    </div>

                                                    {selectedIds.size > 0 && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={handleBulkDelete}
                                                            disabled={deletingIds.size > 0}
                                                            className="shrink-0"
                                                        >
                                                            {deletingIds.size > 0 ? (
                                                                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4 me-2" />
                                                            )}
                                                            {t('Delete :count selected', { count: selectedIds.size })}
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                {/* Upload Zone */}
                                                <FileUploadZone
                                                    projectId={selectedProjectId!}
                                                    maxFileSizeMb={planLimits.max_file_size_mb}
                                                    allowedTypes={planLimits.allowed_file_types}
                                                    onUploadComplete={handleUploadComplete}
                                                    onStorageUpdate={handleStorageUpdate}
                                                />

                                                {/* File Grid */}
                                                {loading ? (
                                                    <FileGridSkeleton className="p-0" />
                                                ) : files.length === 0 ? (
                                                    <EmptyState
                                                        variant="card"
                                                        className="py-12 bg-muted/10"
                                                        icon={<Files className="h-12 w-12" />}
                                                        title={t('No files in this project')}
                                                        description={t('Drag & drop files above or use the generated app to upload files.')}
                                                    />
                                                ) : (
                                                    <>
                                                        <FileGrid
                                                            files={files}
                                                            selectedIds={selectedIds}
                                                            onSelect={handleSelect}
                                                            onSelectAll={handleSelectAll}
                                                            onDelete={handleDelete}
                                                            onPreview={handlePreview}
                                                            deleting={deletingIds}
                                                        />

                                                        {/* Load More Button */}
                                                        {pagination?.has_more && (
                                                            <div className="flex justify-center pt-4">
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={loadMore}
                                                                    disabled={loadingMore}
                                                                >
                                                                    {loadingMore ? (
                                                                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                                                    ) : null}
                                                                    {t('Load More (:remaining remaining)', { remaining: pagination.total - files.length })}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ) : null}
                                </div>
                                )}
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            {/* Preview Modal */}
            <FilePreviewModal
                file={previewFile}
                open={previewFile !== null}
                onClose={() => setPreviewFile(null)}
            />
        </>
    );
}
