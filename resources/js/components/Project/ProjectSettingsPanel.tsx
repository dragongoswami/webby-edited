import { useState, useEffect, useCallback, useRef, FormEvent, useMemo, Fragment } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
    Check,
    Copy,
    Database,
    Eye,
    EyeOff,
    Github,
    Globe,
    HardDrive,
    ImagePlus,
    Key,
    Loader2,
    Lock,
    RefreshCw,
    Settings2,
    ShoppingBag,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { CustomDomainCard } from './CustomDomainCard';
import { DatabaseCard } from './DatabaseCard';
import { useTranslation } from '@/contexts/LanguageContext';

interface SubdomainUsage {
    used: number;
    limit: number | null;
    unlimited: boolean;
    remaining: number;
}

interface StorageSettings {
    enabled: boolean;
    usedBytes: number;
    limitMb: number | null;
    unlimited: boolean;
}

interface CustomDomainUsage {
    used: number;
    limit: number | null;
    unlimited: boolean;
    remaining: number;
}

export interface CustomDomainSettings {
    enabled: boolean;
    canCreateMore: boolean;
    usage: CustomDomainUsage;
    baseDomain: string | null;
}

interface ProjectSettingsPanelProps {
    project: {
        id: string;
        name: string;
        subdomain: string | null;
        published_title: string | null;
        published_description: string | null;
        published_visibility: string;
        share_image: string | null;
        custom_instructions: string | null;
        api_token?: string | null;
        custom_domain?: string | null;
        custom_domain_verified?: boolean;
        custom_domain_ssl_status?: string | null;
        github_repo_name?: string | null;
        github_auto_push?: boolean;
        supabase_connection_id?: number | null;
        shopify_connection_id?: number | null;
        shopify_store_domain?: string | null;
        output_target?: 'website' | 'wordpress_theme' | 'shopify_theme';
    };
    baseDomain: string;
    canUseSubdomains: boolean;
    canCreateMoreSubdomains: boolean;
    canUsePrivateVisibility: boolean;
    subdomainUsage: SubdomainUsage;
    suggestedSubdomain: string;
    storage?: StorageSettings;
    customDomain?: CustomDomainSettings;
    subdomainsGloballyEnabled?: boolean;
    customDomainsGloballyEnabled?: boolean;
}

type SettingsTab = 'general' | 'domains' | 'knowledge' | 'database' | 'storage';
export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';

export function ProjectSettingsPanel({
    project,
    baseDomain,
    canUseSubdomains,
    canCreateMoreSubdomains,
    canUsePrivateVisibility,
    subdomainUsage,
    suggestedSubdomain,
    storage,
    customDomain,
    subdomainsGloballyEnabled = false,
    customDomainsGloballyEnabled = false,
}: ProjectSettingsPanelProps) {
    const { t } = useTranslation();
    const pageProps = usePage().props as {
        canUseGithub?: boolean;
        databaseEnabled?: boolean;
        canConnectShopify?: boolean;
        shopifyConnections?: { id: number; label: string; shop_domain: string }[];
    };
    const canUseGithub = !!pageProps.canUseGithub;
    const databaseEnabled = !!pageProps.databaseEnabled;
    const canConnectShopify = !!pageProps.canConnectShopify;
    const shopifyConnections = pageProps.shopifyConnections ?? [];

    // WordPress themes are a downloadable artifact, not a hosted site: the whole
    // publishing/hosting surface (domains, public/private visibility, social
    // share metadata, file storage + generated-app API token) does not apply.
    // Hide it so the Settings only show what's relevant to a theme.
    const isWordPress = project.output_target === 'wordpress_theme';

    // Dynamic tab configuration based on global settings
    const tabConfig = useMemo(() => {
        const tabs: Array<{ key: SettingsTab; labelKey: string; icon: typeof Settings2 }> = [
            { key: 'general', labelKey: 'General', icon: Settings2 },
        ];

        // Only show domains tab if at least one domain feature is globally enabled
        // — and never for WordPress themes (nothing is hosted on a subdomain).
        if (!isWordPress && (subdomainsGloballyEnabled || customDomainsGloballyEnabled)) {
            tabs.push({ key: 'domains', labelKey: 'Domains', icon: Globe });
        }

        tabs.push({ key: 'knowledge', labelKey: 'Knowledge', icon: Sparkles });

        // Database (BYOD Supabase) — website projects only. Shown when the plan
        // has the capability, or while a connection is still attached so a
        // downgraded user can see and detach it.
        if (!isWordPress && (databaseEnabled || project.supabase_connection_id != null)) {
            tabs.push({ key: 'database', labelKey: 'Database', icon: Database });
        }

        // The storage/API tab carries the generated-app API token (+ file storage
        // when the plan has it). A WordPress theme makes no API calls back to the
        // platform and uses no platform storage, so omit it entirely.
        if (!isWordPress) {
            tabs.push(
                storage?.enabled
                    ? { key: 'storage', labelKey: 'Storage', icon: HardDrive }
                    : { key: 'storage', labelKey: 'API', icon: Key }
            );
        }

        return tabs;
    }, [isWordPress, subdomainsGloballyEnabled, customDomainsGloballyEnabled, storage?.enabled, databaseEnabled, project.supabase_connection_id]);

    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    // The panel instance is reused across Inertia navigations, so if the open
    // tab is no longer available for the new project (e.g. switching from a
    // website project on the Storage/Domains tab to a WordPress project, which
    // hides those), fall back to General instead of rendering an orphaned card.
    useEffect(() => {
        if (!tabConfig.some(tab => tab.key === activeTab)) {
            setActiveTab('general');
        }
    }, [tabConfig, activeTab]);

    // API Token state
    const [apiToken, setApiToken] = useState<string | null>(project.api_token ?? null);
    const [isGeneratingToken, setIsGeneratingToken] = useState(false);
    const [isRevokingToken, setIsRevokingToken] = useState(false);
    const [showToken, setShowToken] = useState(false);

    // General tab state
    const [name, setName] = useState(project.name);
    const [title, setTitle] = useState(project.published_title || project.name);
    const [description, setDescription] = useState(project.published_description || '');
    const [visibility, setVisibility] = useState<'public' | 'private'>(
        (project.published_visibility as 'public' | 'private') || 'public'
    );
    const [isSavingGeneral, setIsSavingGeneral] = useState(false);

    // GitHub auto-push state
    const [autoPush, setAutoPush] = useState<boolean>(project.github_auto_push ?? true);
    const [isSavingAutoPush, setIsSavingAutoPush] = useState(false);

    // Shopify store attach state — null means "no store, download only".
    const [shopifyConnectionId, setShopifyConnectionId] = useState<number | null>(project.shopify_connection_id ?? null);
    const [isSavingShopify, setIsSavingShopify] = useState(false);

    // Domains tab state - subdomain
    const [subdomain, setSubdomain] = useState(project.subdomain || suggestedSubdomain);
    const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('idle');
    const [availabilityErrors, setAvailabilityErrors] = useState<string[]>([]);
    const [isPublishing, setIsPublishing] = useState(false);

    // Knowledge tab state
    const [customInstructions, setCustomInstructions] = useState(project.custom_instructions || '');
    const [isSavingKnowledge, setIsSavingKnowledge] = useState(false);

    // Share image state
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isDeletingImage, setIsDeletingImage] = useState(false);

    // Keep local form state in sync when Inertia refreshes props (e.g. after a
    // publish/unpublish router.reload()). useState only seeds once on mount, so
    // without this the inputs show stale values after any cross-action reload.
    useEffect(() => {
        setName(project.name);
    }, [project.name]);
    useEffect(() => {
        setTitle(project.published_title || project.name);
    }, [project.published_title, project.name]);
    useEffect(() => {
        setDescription(project.published_description || '');
    }, [project.published_description]);
    useEffect(() => {
        setVisibility((project.published_visibility as 'public' | 'private') || 'public');
    }, [project.published_visibility]);
    // Don't re-seed the subdomain from props once the user has typed into it —
    // a cross-action reload could otherwise reset their in-progress edit (e.g. if
    // the auto-suggested slug changes between requests).
    const subdomainTouched = useRef(false);
    useEffect(() => {
        if (!subdomainTouched.current) {
            setSubdomain(project.subdomain || suggestedSubdomain);
        }
    }, [project.subdomain, suggestedSubdomain]);
    useEffect(() => {
        setCustomInstructions(project.custom_instructions || '');
    }, [project.custom_instructions]);
    useEffect(() => {
        setAutoPush(project.github_auto_push ?? true);
    }, [project.github_auto_push]);
    useEffect(() => {
        setShopifyConnectionId(project.shopify_connection_id ?? null);
    }, [project.shopify_connection_id]);

    const isPublished = project.subdomain !== null;
    const canPublish = canUseSubdomains && (isPublished || canCreateMoreSubdomains);

    // Debounced availability check
    const checkAvailability = useCallback(async (value: string) => {
        if (!canUseSubdomains) return;

        if (value.length < 3) {
            setAvailabilityStatus('invalid');
            setAvailabilityErrors([t('Subdomain must be at least 3 characters.')]);
            return;
        }

        setAvailabilityStatus('checking');

        try {
            const response = await axios.post('/api/subdomain/check-availability', {
                subdomain: value,
                project_id: project.id,
            });

            if (response.data.available) {
                setAvailabilityStatus('available');
                setAvailabilityErrors([]);
            } else {
                setAvailabilityStatus('unavailable');
                setAvailabilityErrors(response.data.errors || [t('Subdomain is not available.')]);
            }
        } catch {
            setAvailabilityStatus('idle');
        }
    }, [canUseSubdomains, project.id, t]);

    useEffect(() => {
        if (!canUseSubdomains) return;

        const timeoutId = setTimeout(() => {
            if (subdomain && subdomain.length >= 3) {
                checkAvailability(subdomain);
            } else if (subdomain.length > 0) {
                setAvailabilityStatus('invalid');
                setAvailabilityErrors([t('Subdomain must be at least 3 characters.')]);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [subdomain, checkAvailability, canUseSubdomains, t]);

    const handleSaveGeneral = async (e: FormEvent) => {
        e.preventDefault();
        setIsSavingGeneral(true);

        router.put(`/project/${project.id}/settings/general`, {
            name,
            // Publish/share metadata is hidden for WordPress themes — don't submit
            // it, so saving the (name-only) General tab can't silently reset a
            // value like visibility to its default.
            ...(isWordPress ? {} : {
                published_title: title,
                published_description: description,
                published_visibility: visibility,
            }),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Settings saved'));
            },
            onError: (errors) => {
                const msg = Object.values(errors).flat().filter(Boolean).join(' ');
                toast.error(msg || t('Failed to save settings'));
            },
            onFinish: () => {
                setIsSavingGeneral(false);
            },
        });
    };

    const handleToggleAutoPush = async (checked: boolean) => {
        const previous = autoPush;
        setAutoPush(checked); // optimistic
        setIsSavingAutoPush(true);

        try {
            await axios.patch(`/projects/${project.id}/github/auto-push`, { auto_push: checked });
            toast.success(checked ? t('Auto-push enabled') : t('Auto-push disabled'));
        } catch {
            setAutoPush(previous); // revert on failure
            toast.error(t('Failed to update auto-push'));
        } finally {
            setIsSavingAutoPush(false);
        }
    };

    const handleAttachStore = async (connectionId: number | null) => {
        const previous = shopifyConnectionId;
        setShopifyConnectionId(connectionId); // optimistic
        setIsSavingShopify(true);

        try {
            await axios.patch(`/projects/${project.id}/shopify`, { connection_id: connectionId });
            toast.success(connectionId ? t('Shopify store connected') : t('Shopify store disconnected'));
        } catch {
            setShopifyConnectionId(previous); // revert on failure
            toast.error(t('Failed to update Shopify store'));
        } finally {
            setIsSavingShopify(false);
        }
    };

    const handlePublish = async () => {
        setIsPublishing(true);

        try {
            // Title/description are saved in the General tab (and applied from the
            // DB on publish); sending them here did nothing and falsely implied an
            // unsaved General draft would be applied.
            const response = await axios.post(`/project/${project.id}/publish`, {
                subdomain,
                visibility,
            });

            if (response.data.success) {
                toast.success(isPublished ? t('Project updated') : t('Project published!'));
                subdomainTouched.current = false; // re-seed from the persisted subdomain
                router.reload();
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            toast.error(error.response?.data?.error || t('Failed to publish'));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleUnpublish = async () => {
        setIsPublishing(true);

        try {
            await axios.post(`/project/${project.id}/unpublish`);
            toast.success(t('Project unpublished'));
            subdomainTouched.current = false; // re-seed from the (now suggested) subdomain
            router.reload();
        } catch {
            toast.error(t('Failed to unpublish'));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleSaveKnowledge = async (e: FormEvent) => {
        e.preventDefault();
        setIsSavingKnowledge(true);

        router.put(`/project/${project.id}/settings/knowledge`, {
            custom_instructions: customInstructions,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Custom instructions saved'));
            },
            onError: (errors) => {
                const msg = Object.values(errors).flat().filter(Boolean).join(' ');
                toast.error(msg || t('Failed to save custom instructions'));
            },
            onFinish: () => {
                setIsSavingKnowledge(false);
            },
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append('share_image', file);

        router.post(`/project/${project.id}/settings/share-image`, formData, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Share image uploaded'));
            },
            onError: () => {
                toast.error(t('Failed to upload image'));
            },
            onFinish: () => {
                setIsUploadingImage(false);
            },
        });
    };

    const handleDeleteImage = async () => {
        setIsDeletingImage(true);

        router.delete(`/project/${project.id}/settings/share-image`, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Share image removed'));
            },
            onError: () => {
                toast.error(t('Failed to remove image'));
            },
            onFinish: () => {
                setIsDeletingImage(false);
            },
        });
    };

    const getAvailabilityIcon = () => {
        switch (availabilityStatus) {
            case 'checking':
                return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
            case 'available':
                return <Check className="h-4 w-4 text-success" />;
            case 'unavailable':
            case 'invalid':
                return <X className="h-4 w-4 text-destructive" />;
            default:
                return null;
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <form onSubmit={handleSaveGeneral}>
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('General Settings')}</CardTitle>
                                <CardDescription>
                                    {isWordPress
                                        ? t('Name your project. Your theme details live in style.css.')
                                        : t('Configure how your project appears when shared.')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name">{t('Project Name')}</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t('My Awesome Project')}
                                        maxLength={255}
                                    />
                                </div>

                                {/* Title / Description / Visibility / Share Image are all
                                    publish-and-share metadata for a hosted site — hidden for
                                    WordPress themes, which are downloaded, not hosted. */}
                                {!isWordPress && (<>
                                <div className="space-y-2">
                                    <Label htmlFor="title">{t('Title')}</Label>
                                    <Input
                                        id="title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={t('My Awesome Project')}
                                        maxLength={255}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('Used when your project is shared or published.')}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="description">{t('Description')}</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {description.length}/150
                                        </span>
                                    </div>
                                    <Textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value.slice(0, 150))}
                                        placeholder={t('A brief description of your project')}
                                        rows={3}
                                        maxLength={150}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="visibility">{t('Visibility')}</Label>
                                    <Select
                                        value={visibility}
                                        onValueChange={(value: 'public' | 'private') => setVisibility(value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="public">
                                                <div className="flex items-center gap-2">
                                                    <Eye className="h-4 w-4" />
                                                    <span>{t('Public')}</span>
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="private" disabled={!canUsePrivateVisibility}>
                                                <div className="flex items-center gap-2">
                                                    <EyeOff className="h-4 w-4" />
                                                    <span>{t('Private')}</span>
                                                    {!canUsePrivateVisibility && <Lock className="h-3 w-3 ms-1" />}
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {!canUsePrivateVisibility
                                            ? t('Upgrade to unlock private visibility')
                                            : visibility === 'public'
                                                ? t('Anyone with the link can view your project.')
                                                : t('Only you can view your project.')}
                                    </p>
                                </div>

                                {/* Share Image */}
                                <div className="space-y-2">
                                    <Label>{t('Share Image')}</Label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        {t('This image will be shown when your project is shared on social media.')}
                                    </p>

                                    {project.share_image ? (
                                        <div className="relative group w-full aspect-[1200/630] rounded-lg border overflow-hidden bg-muted">
                                            <img
                                                src={`/storage/${project.share_image}`}
                                                alt={t('Share preview')}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            disabled={isDeletingImage}
                                                        >
                                                            {isDeletingImage ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                            <span className="ms-1">{t('Remove')}</span>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>{t('Remove share image?')}</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {t('This cannot be undone.')}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDeleteImage}>
                                                                {t('Remove')}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center w-full aspect-[1200/630] rounded-lg border-2 border-dashed hover:border-primary/50 transition-colors cursor-pointer bg-muted/50">
                                            <div className="flex flex-col items-center justify-center py-6">
                                                {isUploadingImage ? (
                                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <>
                                                        <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                                                        <p className="text-sm text-muted-foreground">
                                                            {t('Click to upload (1200x630 recommended)')}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={handleImageUpload}
                                                disabled={isUploadingImage}
                                            />
                                        </label>
                                    )}
                                </div>
                                </>)}

                                {/* GitHub auto-push toggle — only when the project has a linked repo and the plan allows GitHub */}
                                {canUseGithub && project.github_repo_name && (
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="flex items-center gap-2">
                                                <Github className="h-4 w-4" />
                                                {t('Auto-push to GitHub')}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('Automatically push changes to :repo after each build.', { repo: project.github_repo_name })}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={autoPush}
                                            disabled={isSavingAutoPush}
                                            onCheckedChange={handleToggleAutoPush}
                                            aria-label={t('Auto-push to GitHub')}
                                        />
                                    </div>
                                )}

                                {/* Shopify store — Shopify themes only. The store is optional:
                                    a theme builds/downloads without one. Attaches/detaches via
                                    its own axios call (not tied to the General save button). */}
                                {canConnectShopify && project.output_target === 'shopify_theme' && (
                                    <div className="space-y-3 p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="flex items-center gap-2">
                                                <ShoppingBag className="h-4 w-4" />
                                                {t('Shopify store')}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('Push this theme to a connected store after each build. Leave unset to keep it download-only.')}
                                            </p>
                                        </div>
                                        {shopifyConnections.length > 0 ? (
                                            <Select
                                                value={shopifyConnectionId?.toString() ?? 'none'}
                                                onValueChange={(v) => handleAttachStore(v === 'none' ? null : parseInt(v))}
                                                disabled={isSavingShopify}
                                            >
                                                <SelectTrigger aria-label={t('Shopify store')}><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">
                                                        <div className="flex items-center gap-2">
                                                            <ShoppingBag className="h-4 w-4" />
                                                            <span>{t('No store — download only')}</span>
                                                        </div>
                                                    </SelectItem>
                                                    {shopifyConnections.map((connection) => (
                                                        <SelectItem key={connection.id} value={connection.id.toString()}>
                                                            <div className="flex items-center gap-2">
                                                                <ShoppingBag className="h-4 w-4" />
                                                                <span>{connection.label || connection.shop_domain}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                {t('Connect a store on the Shopify page to auto-push this theme.').split(':link').map((part, i) => (
                                                    <Fragment key={i}>
                                                        {i > 0 && <Link href="/shopify" className="text-primary hover:underline">{t('Shopify page')}</Link>}
                                                        {part}
                                                    </Fragment>
                                                ))}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={isSavingGeneral}>
                                        {isSavingGeneral && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                        {t('Save Changes')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                );

            case 'domains':
                return (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Globe className="h-5 w-5" />
                                            {t('Subdomain')}
                                        </CardTitle>
                                        <CardDescription>
                                            {t('Publish your project to a custom subdomain.')}
                                        </CardDescription>
                                    </div>
                                    {isPublished && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-success/10 text-success">
                                            <Check className="h-3 w-3 me-1" />
                                            {t('Published')}
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {!canUseSubdomains ? (
                                    <div className="rounded-lg border p-4 text-center">
                                        <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground mb-3">
                                            {t('Subdomain publishing is not available on your current plan.')}
                                        </p>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href="/billing/plans">{t('View Plans')}</Link>
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="subdomain">{t('Subdomain')}</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        id="subdomain"
                                                        value={subdomain}
                                                        onChange={(e) => {
                                                            subdomainTouched.current = true;
                                                            setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                                        }}
                                                        placeholder="my-project"
                                                        className="pe-8"
                                                    />
                                                    <div className="absolute end-2 top-1/2 -translate-y-1/2">
                                                        {getAvailabilityIcon()}
                                                    </div>
                                                </div>
                                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                                    .{baseDomain}
                                                </span>
                                            </div>
                                            {availabilityErrors.length > 0 && availabilityStatus !== 'available' && (
                                                <p className="text-xs text-destructive">{availabilityErrors[0]}</p>
                                            )}
                                            {availabilityStatus === 'available' && (
                                                <p className="text-xs text-success">{t('This subdomain is available!')}</p>
                                            )}
                                        </div>

                                        {isPublished && (
                                            <div className="rounded-lg border p-3 bg-muted/50">
                                                <p className="text-sm text-muted-foreground">
                                                    {t('Your project is live at:')}{' '}
                                                    <a
                                                        href={`https://${project.subdomain}.${baseDomain}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline"
                                                    >
                                                        {project.subdomain}.{baseDomain}
                                                    </a>
                                                </p>
                                            </div>
                                        )}

                                        {!subdomainUsage.unlimited && subdomainUsage.limit && (
                                            <p className="text-xs text-muted-foreground">
                                                {t('Subdomain usage: :used / :limit', { used: subdomainUsage.used, limit: subdomainUsage.limit })}
                                            </p>
                                        )}

                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handlePublish}
                                                disabled={
                                                    isPublishing ||
                                                    !canPublish ||
                                                    availabilityStatus === 'checking' ||
                                                    availabilityStatus === 'unavailable' ||
                                                    availabilityStatus === 'invalid'
                                                }
                                            >
                                                {isPublishing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                                {isPublished ? t('Update Subdomain') : t('Publish')}
                                            </Button>
                                            {isPublished && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" disabled={isPublishing}>
                                                            {t('Unpublish')}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>{t('Unpublish this project?')}</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                {t('Unpublishing takes your project offline. Anyone with the link will no longer be able to view it.')}
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleUnpublish}>
                                                                {t('Unpublish')}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Custom Domain Card */}
                        {customDomain && (
                            <CustomDomainCard project={project} customDomain={customDomain} />
                        )}
                    </div>
                );

            case 'knowledge':
                return (
                    <form onSubmit={handleSaveKnowledge}>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="h-5 w-5" />
                                    {t('Custom Instructions')}
                                </CardTitle>
                                <CardDescription>
                                    {t('Guide the AI when building your project. These instructions will be included in every conversation with the AI.')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="custom_instructions">{t('Instructions')}</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {customInstructions.length}/500
                                        </span>
                                    </div>
                                    <Textarea
                                        id="custom_instructions"
                                        value={customInstructions}
                                        onChange={(e) => setCustomInstructions(e.target.value.slice(0, 500))}
                                        placeholder="E.g., Use a modern minimalist design style. Focus on accessibility. Use TypeScript for all code."
                                        rows={6}
                                        maxLength={500}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('Be concise and specific. These instructions help the AI understand your preferences and requirements.')}
                                    </p>
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={isSavingKnowledge}>
                                        {isSavingKnowledge && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                        {t('Save Instructions')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                );

            case 'database':
                return (
                    <DatabaseCard
                        projectId={project.id}
                        connectionId={project.supabase_connection_id ?? null}
                        canUseDatabase={databaseEnabled}
                    />
                );

            case 'storage':
                return (
                    <div className="space-y-6">
                        {/* API Token Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Key className="h-5 w-5" />
                                    {t('API Token')}
                                </CardTitle>
                                <CardDescription>
                                    {t('Generate an API token for your generated app to upload files and access data.')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {apiToken ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label>{t('Current Token')}</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    value={showToken ? apiToken : '••••••••••••••••••••••••••••••••'}
                                                    readOnly
                                                    className="font-mono text-sm"
                                                />
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={showToken ? t('Hide token') : t('Show token')}
                                                    onClick={() => setShowToken(!showToken)}
                                                >
                                                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t('Copy token')}
                                                    onClick={async () => {
                                                        if (navigator.clipboard && window.isSecureContext) {
                                                            await navigator.clipboard.writeText(apiToken);
                                                            toast.success(t('Token copied to clipboard'));
                                                        } else {
                                                            toast.error(t('Copying requires a secure (HTTPS) connection.'));
                                                        }
                                                    }}
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {t('Use this token in your app\'s X-Project-Token header.')}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" disabled={isGeneratingToken}>
                                                        <RefreshCw className="h-4 w-4 me-2" />
                                                        {t('Regenerate')}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('Regenerate API Token?')}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t('This will invalidate the current token. Any apps using the old token will need to be updated.')}
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={async () => {
                                                                setIsGeneratingToken(true);
                                                                try {
                                                                    const response = await axios.post(`/project/${project.id}/api-token/regenerate`);
                                                                    setApiToken(response.data.token);
                                                                    setShowToken(true);
                                                                    toast.success(t('API token regenerated'));
                                                                } catch {
                                                                    toast.error(t('Failed to regenerate token'));
                                                                } finally {
                                                                    setIsGeneratingToken(false);
                                                                }
                                                            }}
                                                        >
                                                            {t('Regenerate')}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" disabled={isRevokingToken}>
                                                        <Trash2 className="h-4 w-4 me-2" />
                                                        {t('Revoke')}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('Revoke API Token?')}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t('This will immediately revoke the token. Any apps using this token will lose access.')}
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            onClick={async () => {
                                                                setIsRevokingToken(true);
                                                                try {
                                                                    await axios.delete(`/project/${project.id}/api-token`);
                                                                    setApiToken(null);
                                                                    toast.success(t('API token revoked'));
                                                                } catch {
                                                                    toast.error(t('Failed to revoke token'));
                                                                } finally {
                                                                    setIsRevokingToken(false);
                                                                }
                                                            }}
                                                        >
                                                            {t('Revoke')}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                                        <Key className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {t('No API token generated yet')}
                                        </p>
                                        <Button
                                            onClick={async () => {
                                                setIsGeneratingToken(true);
                                                try {
                                                    const response = await axios.post(`/project/${project.id}/api-token`);
                                                    setApiToken(response.data.token);
                                                    setShowToken(true);
                                                    toast.success(t('API token generated'));
                                                } catch {
                                                    toast.error(t('Failed to generate token'));
                                                } finally {
                                                    setIsGeneratingToken(false);
                                                }
                                            }}
                                            disabled={isGeneratingToken}
                                        >
                                            {isGeneratingToken && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                            {t('Generate API Token')}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Storage Usage Card */}
                        {storage?.enabled && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <HardDrive className="h-5 w-5" />
                                        {t('File Storage')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('Storage usage for this project.')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>{t('Used:')} {formatBytes(storage.usedBytes)}</span>
                                            <span>
                                                {storage.unlimited ? (
                                                    <Badge variant="secondary">{t('Unlimited')}</Badge>
                                                ) : (
                                                    t(':total MB total', { total: storage.limitMb ?? 0 })
                                                )}
                                            </span>
                                        </div>
                                        {!storage.unlimited && storage.limitMb && (
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all"
                                                    style={{
                                                        width: `${Math.min(100, (storage.usedBytes / (storage.limitMb * 1024 * 1024)) * 100)}%`,
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {t('Files uploaded via dashboard or generated app count toward the same quota.')}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                    </div>
                );

            default:
                return null;
        }
    };

    // Helper function to format bytes
    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
                {/* Tab Navigation - horizontal pills. Scrolls horizontally on narrow
                    screens so trailing tabs (Database, Storage) stay reachable on mobile. */}
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit max-w-full overflow-x-auto scrollbar-hide">
                    {tabConfig.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            type="button"
                            className={cn(
                                'flex shrink-0 items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                                activeTab === tab.key
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {renderContent()}
            </div>
        </ScrollArea>
    );
}
