import { Head, Link, router } from '@inertiajs/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { usePageLoading } from '@/hooks/usePageLoading';
import { useTranslation } from '@/contexts/LanguageContext';
import { ProjectCardSkeleton } from '@/components/skeletons';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
    TableActionMenuSeparator,
} from '@/components/ui/table-action-menu';
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
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { AppPageHeader } from '@/components/Header/AppPageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { Project, ProjectsPageProps, ProjectSort, ProjectVisibility } from '@/types';
import type { ProjectStatusEvent } from '@/types/notifications';
import { formatEditedTime, formatDeletedTime } from './projectTime';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import {
    Search,
    Blocks,
    Folder,
    LayoutGrid,
    List,
    Maximize2,
    Star,
    StarOff,
    Copy,
    Trash2,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Plus,
} from 'lucide-react';

type ViewMode = 'grid' | 'list' | 'large';

interface ProjectCardProps {
    project: Project;
    isTrash?: boolean;
    thumbnailUrl?: string | null;
    onToggleStar?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onDelete?: (project: Project) => void;
    onRestore?: (id: string) => void;
    onPermanentDelete?: (id: string) => void;
}

function ProjectCard({
    project,
    isTrash = false,
    thumbnailUrl,
    onToggleStar,
    onDuplicate,
    onDelete,
    onRestore,
    onPermanentDelete,
}: ProjectCardProps) {
    const { t } = useTranslation();

    return (
        <div className="group relative">
            <Link href={isTrash ? '#' : `/project/${project.id}`} className={isTrash ? 'pointer-events-none' : ''}>
                <div className="aspect-[4/3] rounded-xl border bg-card overflow-hidden mb-3 hover:shadow-lg transition-shadow">
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={project.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : project.output_target === 'wordpress_theme' ? (
                        // WordPress theme projects have no captured thumbnail
                        // (the preview is an in-browser WordPress) — show a
                        // labelled placeholder instead of the generic folder.
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/50">
                            <Blocks className="h-12 w-12 text-muted-foreground/30" />
                            <span className="text-xs text-muted-foreground/60">{t('WordPress Theme')}</span>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/50">
                            <Folder className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                    )}
                </div>
            </Link>

            {/* Actions dropdown */}
            <TableActionMenu>
                <TableActionMenuTrigger className="absolute top-2 end-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity bg-background/80 hover:bg-background h-8 w-8 p-0" />
                <TableActionMenuContent>
                    {isTrash ? (
                        <>
                            <TableActionMenuItem onClick={() => onRestore?.(project.id)}>
                                <RotateCcw className="h-4 w-4 me-2" />
                                {t('Restore')}
                            </TableActionMenuItem>
                            <TableActionMenuItem
                                onClick={() => onPermanentDelete?.(project.id)}
                                variant="destructive"
                            >
                                <Trash2 className="h-4 w-4 me-2" />
                                {t('Delete permanently')}
                            </TableActionMenuItem>
                        </>
                    ) : (
                        <>
                            <TableActionMenuItem onClick={() => onToggleStar?.(project.id)}>
                                {project.is_starred ? (
                                    <>
                                        <StarOff className="h-4 w-4 me-2" />
                                        {t('Remove from favorites')}
                                    </>
                                ) : (
                                    <>
                                        <Star className="h-4 w-4 me-2" />
                                        {t('Add to favorites')}
                                    </>
                                )}
                            </TableActionMenuItem>
                            <TableActionMenuItem onClick={() => onDuplicate?.(project.id)}>
                                <Copy className="h-4 w-4 me-2" />
                                {t('Duplicate')}
                            </TableActionMenuItem>
                            <TableActionMenuSeparator />
                            <TableActionMenuItem
                                onClick={() => onDelete?.(project)}
                                variant="destructive"
                            >
                                <Trash2 className="h-4 w-4 me-2" />
                                {t('Move to trash')}
                            </TableActionMenuItem>
                        </>
                    )}
                </TableActionMenuContent>
            </TableActionMenu>
            {/* Live build-status badge (building / failed) */}
            <ProjectStatusBadge status={project.build_status} isTrash={isTrash} />

            {/* Star indicator */}
            {project.is_starred && !isTrash && (
                <Star className="absolute top-2 start-2 h-4 w-4 text-warning fill-warning" />
            )}

            <div>
                <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                    {project.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isTrash && project.deleted_at
                        ? formatDeletedTime(t, project.deleted_at)
                        : formatEditedTime(t, project.updated_at)}
                </p>
            </div>
        </div>
    );
}

export default function ProjectsIndex({ auth, projects, counts, activeTab, filters, baseDomain }: ProjectsPageProps) {
    const user = auth.user!;
    const { isLoading } = usePageLoading();
    const { t } = useTranslation();

    // Real-time project status updates
    const [projectStatuses, setProjectStatuses] = useState<Record<string, Project['build_status']>>({});

    const handleProjectStatus = useCallback((status: ProjectStatusEvent) => {
        setProjectStatuses(prev => ({
            ...prev,
            [status.project_id]: status.build_status as Project['build_status'],
        }));
    }, []);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [trashDialogOpen, setTrashDialogOpen] = useState(false);
    const [projectToTrash, setProjectToTrash] = useState<string | null>(null);
    const [projectToTrashInfo, setProjectToTrashInfo] = useState<{
        subdomain: string | null;
        customDomain: string | null;
    } | null>(null);
    const [searchValue, setSearchValue] = useState(filters.search || '');
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('projects-view') as ViewMode) || 'grid';
        }
        return 'grid';
    });

    // Persist view mode to localStorage
    useEffect(() => {
        localStorage.setItem('projects-view', viewMode);
    }, [viewMode]);

    // Helper function to get thumbnail URL with cache busting
    const getThumbnailUrl = useCallback((project: Project): string | null => {
        if (!project.thumbnail) return null;
        // Cache buster based on updated_at
        const cacheBuster = project.updated_at ? `?v=${new Date(project.updated_at).getTime()}` : '';
        // If already a full URL, return as-is
        if (project.thumbnail.startsWith('http')) {
            return project.thumbnail + cacheBuster;
        }
        if (project.thumbnail.startsWith('/storage/')) {
            return project.thumbnail + cacheBuster;
        }
        // Prepend /storage/ for local storage paths
        return `/storage/${project.thumbnail}${cacheBuster}`;
    }, []);

    // Handle filter changes with URL navigation
    const handleFilterChange = useCallback((newFilters: Partial<{ search?: string; sort?: ProjectSort; visibility?: ProjectVisibility | null }>) => {
        const url = activeTab === 'trash' ? '/projects/trash' : '/projects';
        const params: Record<string, string> = {};

        // Preserve tab for non-trash
        if (activeTab !== 'trash' && activeTab !== 'all') {
            params.tab = activeTab;
        }

        // Build search param
        const searchVal = newFilters.search !== undefined ? newFilters.search : filters.search;
        if (searchVal) params.search = searchVal;

        // Build sort param
        const sortVal = newFilters.sort !== undefined ? newFilters.sort : filters.sort;
        if (sortVal && sortVal !== 'last-edited') params.sort = sortVal;

        // Build visibility param (not for trash)
        if (activeTab !== 'trash') {
            const visibilityVal = newFilters.visibility !== undefined ? newFilters.visibility : filters.visibility;
            if (visibilityVal) params.visibility = visibilityVal;
        }

        router.get(url, params, { preserveState: true, preserveScroll: true });
    }, [activeTab, filters]);

    // Debounced search handler
    const handleSearchChange = (value: string) => {
        setSearchValue(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            handleFilterChange({ search: value });
        }, 300);
    };

    const handleTabChange = (tab: string) => {
        if (tab === 'trash') {
            router.visit('/projects/trash');
        } else {
            router.visit(`/projects?tab=${tab}`);
        }
    };

    const handleSortChange = (sort: ProjectSort) => {
        handleFilterChange({ sort });
    };

    const handleVisibilityChange = (visibility: string) => {
        handleFilterChange({ visibility: visibility === 'any' ? null : visibility as ProjectVisibility });
    };

    const handlePageChange = (page: number) => {
        const url = activeTab === 'trash' ? '/projects/trash' : '/projects';
        const params: Record<string, string | number> = { page };

        if (activeTab !== 'trash' && activeTab !== 'all') {
            params.tab = activeTab;
        }
        if (filters.search) params.search = filters.search;
        if (filters.sort && filters.sort !== 'last-edited') params.sort = filters.sort;
        if (filters.visibility && activeTab !== 'trash') params.visibility = filters.visibility;

        router.get(url, params, { preserveState: true, preserveScroll: true });
    };

    const handleToggleStar = (id: string) => {
        router.post(`/projects/${id}/toggle-star`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('Project updated')),
            onError: () => toast.error(t('Failed to update project')),
        });
    };

    const handleDuplicate = (id: string) => {
        router.post(`/projects/${id}/duplicate`, {}, {
            onSuccess: () => toast.success(t('Project duplicated')),
            onError: () => toast.error(t('Failed to duplicate project')),
        });
    };

    const handleDelete = (project: Project) => {
        // Check if project has published domains
        if (project.subdomain || project.custom_domain) {
            setProjectToTrash(project.id);
            setProjectToTrashInfo({
                subdomain: project.subdomain ?? null,
                customDomain: project.custom_domain ?? null,
            });
            setTrashDialogOpen(true);
        } else {
            // No published domains, delete directly
            performDelete(project.id);
        }
    };

    const performDelete = (id: string) => {
        router.delete(`/projects/${id}`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Project moved to trash'));
                setTrashDialogOpen(false);
                setProjectToTrash(null);
                setProjectToTrashInfo(null);
            },
            onError: () => toast.error(t('Failed to delete project')),
        });
    };

    const handleRestore = (id: string) => {
        router.post(`/projects/${id}/restore`, {}, {
            onSuccess: () => toast.success(t('Project restored')),
            onError: () => toast.error(t('Failed to restore project')),
        });
    };

    const handlePermanentDelete = (id: string) => {
        setProjectToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmPermanentDelete = () => {
        if (projectToDelete) {
            router.delete(`/projects/${projectToDelete}/force-delete`, {
                onSuccess: () => toast.success(t('Project permanently deleted')),
                onError: () => toast.error(t('Failed to delete project')),
            });
        }
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
    };

    const getEmptyMessage = () => {
        if (filters.search) {
            return t('No projects match your search.');
        }
        switch (activeTab) {
            case 'favorites':
                return t('No favorite projects yet. Star a project to add it here.');
            case 'trash':
                return t('Trash is empty.');
            default:
                return t('No projects yet. Create your first project from the dashboard!');
        }
    };

    // Grid classes based on view mode
    const getGridClasses = () => {
        switch (viewMode) {
            case 'large':
                return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
            case 'list':
                return 'grid-cols-1';
            default: // grid
                return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
        }
    };

    return (
        <>
            <Head title={t('My Projects')} />

            <TooltipProvider>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset>
                        <div className="min-h-screen bg-background">
                            <AppPageHeader user={user} onProjectStatus={handleProjectStatus} />

                            {/* Main Content */}
                            <main className="p-4 md:p-6 lg:p-8">
                                <div className="max-w-7xl mx-auto">
                                    {/* Page Header */}
                                    <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="prose prose-sm dark:prose-invert">
                                            <h1 className="text-2xl font-bold text-foreground">
                                                {t('My Projects')}
                                            </h1>
                                            <p className="text-muted-foreground mt-2">
                                                {t('Manage and organize all your creative work')}
                                            </p>
                                        </div>
                                        <Button asChild className="self-start sm:self-auto">
                                            <Link href="/create">
                                                <Plus className="h-4 w-4 me-1" />
                                                {t('New Project')}
                                            </Link>
                                        </Button>
                                    </div>

                                    {/* Tabs */}
                                    <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-6">
                                        <TabsList>
                                            <TabsTrigger value="all">
                                                {t('All Projects')}
                                                {counts.all > 0 && (
                                                    <span className="ms-2 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                                                        {counts.all}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="favorites">
                                                <Star className="h-4 w-4 me-1" />
                                                {t('Favorites')}
                                                {counts.favorites > 0 && (
                                                    <span className="ms-2 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                                                        {counts.favorites}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="trash">
                                                <Trash2 className="h-4 w-4 me-1" />
                                                {t('Trash')}
                                                {counts.trash > 0 && (
                                                    <span className="ms-2 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
                                                        {counts.trash}
                                                    </span>
                                                )}
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    {/* Filter Bar */}
                                    <div className="flex flex-wrap items-center gap-3 mb-6">
                                        {/* Search */}
                                        <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder={t('Search projects...')}
                                                className="ps-9 bg-background"
                                                value={searchValue}
                                                onChange={(e) => handleSearchChange(e.target.value)}
                                            />
                                        </div>

                                        {/* Sort Dropdown */}
                                        <Select value={filters.sort} onValueChange={handleSortChange}>
                                            <SelectTrigger className="w-[140px] bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="last-edited">{t('Last edited')}</SelectItem>
                                                <SelectItem value="name">{t('Name')}</SelectItem>
                                                <SelectItem value="created">{t('Created')}</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        {/* Visibility Dropdown - hidden in trash */}
                                        {activeTab !== 'trash' && (
                                            <Select
                                                value={filters.visibility || 'any'}
                                                onValueChange={handleVisibilityChange}
                                            >
                                                <SelectTrigger className="w-[140px] bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="any">{t('Any visibility')}</SelectItem>
                                                    <SelectItem value="public">{t('Public')}</SelectItem>
                                                    <SelectItem value="private">{t('Private')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {/* Spacer */}
                                        <div className="flex-1" />

                                        {/* View Toggle */}
                                        <div className="flex items-center border rounded-lg bg-background" role="group" aria-label={t('View mode')}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-e-none ${viewMode === 'large' ? 'bg-muted' : ''}`}
                                                onClick={() => setViewMode('large')}
                                                aria-label={t('Large grid view')}
                                                aria-pressed={viewMode === 'large'}
                                            >
                                                <Maximize2 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-none ${viewMode === 'grid' ? 'bg-muted' : ''}`}
                                                onClick={() => setViewMode('grid')}
                                                aria-label={t('Grid view')}
                                                aria-pressed={viewMode === 'grid'}
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-9 w-9 rounded-s-none ${viewMode === 'list' ? 'bg-muted' : ''}`}
                                                onClick={() => setViewMode('list')}
                                                aria-label={t('List view')}
                                                aria-pressed={viewMode === 'list'}
                                            >
                                                <List className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Trash notice */}
                                    {activeTab === 'trash' && (
                                        <div className="mb-6 p-4 bg-muted rounded-lg">
                                            <p className="text-sm text-muted-foreground">
                                                {t('Items in trash will be automatically deleted after 30 days.')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Projects Grid */}
                                    {isLoading ? (
                                        <div className={`grid ${getGridClasses()} gap-6`}>
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <ProjectCardSkeleton key={i} viewMode={viewMode} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={`grid ${getGridClasses()} gap-6`}>
                                            {projects.data.map((project) => (
                                                <ProjectCard
                                                    key={project.id}
                                                    project={{
                                                        ...project,
                                                        build_status: projectStatuses[project.id] || project.build_status,
                                                    }}
                                                    isTrash={activeTab === 'trash'}
                                                    thumbnailUrl={getThumbnailUrl(project)}
                                                    onToggleStar={handleToggleStar}
                                                    onDuplicate={handleDuplicate}
                                                    onDelete={handleDelete}
                                                    onRestore={handleRestore}
                                                    onPermanentDelete={handlePermanentDelete}
                                                />
                                            ))}

                                            {projects.data.length === 0 && (
                                                <div className="col-span-full">
                                                    <EmptyState
                                                        icon={<Folder className="h-12 w-12" />}
                                                        description={getEmptyMessage()}
                                                        action={
                                                            activeTab === 'all' && !filters.search ? (
                                                                <Button asChild>
                                                                    <Link href="/create">
                                                                        {t('Create your first project')}
                                                                    </Link>
                                                                </Button>
                                                            ) : undefined
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Pagination — hidden while loading */}
                                    {!isLoading && projects.last_page > 1 && (
                                        <div className="flex items-center justify-center gap-2 mt-8">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(projects.current_page - 1)}
                                                disabled={projects.current_page === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4 me-1" />
                                                {t('Previous')}
                                            </Button>
                                            <span className="text-sm text-muted-foreground px-4">
                                                {t('Page :current of :total', { current: projects.current_page, total: projects.last_page })}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(projects.current_page + 1)}
                                                disabled={projects.current_page === projects.last_page}
                                            >
                                                {t('Next')}
                                                <ChevronRight className="h-4 w-4 ms-1" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            {/* Permanent delete confirmation dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Delete permanently?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This action cannot be undone. This project will be permanently deleted.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {t('Delete permanently')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Trash warning dialog for published projects */}
            <AlertDialog open={trashDialogOpen} onOpenChange={setTrashDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Move to Trash?')}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>{t('This project is currently published and accessible at:')}</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {projectToTrashInfo?.subdomain && baseDomain && (
                                        <li><code className="text-xs bg-muted px-1 py-0.5 rounded">{projectToTrashInfo.subdomain}.{baseDomain}</code></li>
                                    )}
                                    {projectToTrashInfo?.customDomain && (
                                        <li><code className="text-xs bg-muted px-1 py-0.5 rounded">{projectToTrashInfo.customDomain}</code></li>
                                    )}
                                </ul>
                                <p className="text-destructive font-medium">
                                    {t('Moving to trash will make these URLs inaccessible.')}
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => projectToTrash && performDelete(projectToTrash)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('Move to Trash')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Toaster />
        </>
    );
}
