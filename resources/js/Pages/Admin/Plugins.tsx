import { useState } from 'react';
import { router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { AdminPageHeader } from '@/components/Admin/AdminPageHeader';
import { useAdminLoading } from '@/hooks/useAdminLoading';
import { CardGridSkeleton } from '@/components/Admin/skeletons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import {
    Settings,
    CreditCard,
    Download,
    Check,
    AlertCircle,
    Building2,
    Copy,
    Wallet,
    Trash2,
    Shield,
    Upload,
    Globe,
    Banknote,
    Bitcoin,
    IndianRupee,
    RussianRuble,
    HardDrive,
    Github,
} from 'lucide-react';
import UploadPluginModal from '@/components/Admin/UploadPluginModal';
import type { AdminPluginsPageProps } from '@/types/admin';
import type { Plugin, PluginConfigField } from '@/types/billing';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';

// Plugin icons are lucide-react component names supplied by each plugin's
// `icon` field in plugin.json (and matching getIcon() PHP method).
// Add new entries here when a plugin uses a lucide icon that isn't already mapped.
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    CreditCard,
    Wallet,
    Building2,
    Globe,
    Banknote,
    Bitcoin,
    IndianRupee,
    RussianRuble,
    HardDrive,
    Github,
    Download,
};

function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
}

export default function Plugins({ auth, plugins }: AdminPluginsPageProps) {
    const { t } = useTranslation();
    const { isLoading: isPageLoading } = useAdminLoading();
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const [isUninstallDialogOpen, setIsUninstallDialogOpen] = useState(false);
    const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
    const [configValues, setConfigValues] = useState<Record<string, string | boolean | number>>({});
    const [configFormErrors, setConfigFormErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const handleInstall = (plugin: Plugin) => {
        setIsLoading(true);
        router.post(
            route('admin.plugins.install', plugin.slug),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`${plugin.name} ${t('installed successfully')}`);
                },
                onError: (errors) => {
                    toast.error(Object.values(errors)[0] as string);
                },
                onFinish: () => setIsLoading(false),
            }
        );
    };

    const handleToggle = (plugin: Plugin) => {
        if (!plugin.is_installed) {
            toast.error(t('Please install the plugin first'));
            return;
        }
        if (!plugin.is_configured && !plugin.is_active) {
            toast.error(t('Please configure the plugin first'));
            openConfigDialog(plugin);
            return;
        }

        router.post(
            route('admin.plugins.toggle', plugin.slug),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(
                        plugin.is_active
                            ? t(':name deactivated', { name: plugin.name })
                            : t(':name activated', { name: plugin.name })
                    );
                },
                onError: (errors) => {
                    toast.error(Object.values(errors)[0] as string);
                },
            }
        );
    };

    const openConfigDialog = (plugin: Plugin) => {
        setSelectedPlugin(plugin);
        // Initialize config values from existing config
        const initialValues: Record<string, string | boolean> = {};
        plugin.config_schema.forEach((field) => {
            if (field.type === 'readonly') return;
            initialValues[field.name] =
                (plugin.config[field.name] as string | boolean) ?? field.default ?? '';
        });
        setConfigValues(initialValues);
        setConfigFormErrors({});
        setIsConfigDialogOpen(true);
    };

    const validateConfigForm = () => {
        if (!selectedPlugin) return false;
        const errors: Record<string, string> = {};
        selectedPlugin.config_schema.forEach((field) => {
            if (field.type === 'readonly') return;
            if (field.required) {
                const value = configValues[field.name];
                if (value === undefined || value === '' || value === null) {
                    errors[field.name] = t(':field is required', { field: field.label });
                }
            }
        });
        setConfigFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleConfigSave = () => {
        if (!selectedPlugin) return;

        if (!validateConfigForm()) {
            return;
        }

        setIsLoading(true);
        router.post(route('admin.plugins.configure', selectedPlugin.slug), configValues, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(t('Plugin configured successfully'));
                setIsConfigDialogOpen(false);
                setSelectedPlugin(null);
                setConfigFormErrors({});
            },
            onError: (errors) => {
                setConfigFormErrors(errors as Record<string, string>);
                toast.error(Object.values(errors)[0] as string);
            },
            onFinish: () => setIsLoading(false),
        });
    };

    const openUninstallDialog = (plugin: Plugin) => {
        setSelectedPlugin(plugin);
        setIsUninstallDialogOpen(true);
    };

    const handleUninstall = () => {
        if (!selectedPlugin) return;

        setIsLoading(true);
        router.delete(route('admin.plugins.uninstall', selectedPlugin.slug), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`${selectedPlugin.name} ${t('uninstalled successfully')}`);
                setIsUninstallDialogOpen(false);
                setSelectedPlugin(null);
            },
            onError: (errors) => {
                toast.error(Object.values(errors)[0] as string);
            },
            onFinish: () => setIsLoading(false),
        });
    };

    const renderConfigField = (field: PluginConfigField) => {
        const value = configValues[field.name];
        const error = configFormErrors[field.name];

        switch (field.type) {
            case 'text':
                return (
                    <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-destructive ms-1">*</span>}
                        </Label>
                        <Input
                            id={field.name}
                            type={field.type}
                            value={(value as string) || ''}
                            onChange={(e) =>
                                setConfigValues({ ...configValues, [field.name]: e.target.value })
                            }
                            placeholder={field.placeholder}
                            className={error ? 'border-destructive' : ''}
                        />
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                        {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                        )}
                    </div>
                );

            case 'password':
                return (
                    <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-destructive ms-1">*</span>}
                        </Label>
                        <PasswordInput
                            id={field.name}
                            revealLabel={t('Show secret')}
                            hideLabel={t('Hide secret')}
                            value={(value as string) || ''}
                            onChange={(e) =>
                                setConfigValues({ ...configValues, [field.name]: e.target.value })
                            }
                            placeholder={field.placeholder}
                            className={error ? 'border-destructive' : ''}
                        />
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                        {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                        )}
                    </div>
                );

            case 'readonly':
                return (
                    <div key={field.name} className="space-y-2">
                        <Label>{field.label}</Label>
                        <div className="flex gap-2">
                            <Input
                                value={(field.default as string) || ''}
                                readOnly
                                className="bg-muted font-mono text-xs cursor-text"
                                onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                                onClick={() => {
                                    copyToClipboard((field.default as string) || '').then(
                                        (ok) => ok
                                            ? toast.success(t('Copied to clipboard'))
                                            : toast.error(t('Failed to copy. Please select and copy manually.')),
                                    );
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                        )}
                    </div>
                );

            case 'textarea':
                return (
                    <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-destructive ms-1">*</span>}
                        </Label>
                        <Textarea
                            id={field.name}
                            value={(value as string) || ''}
                            onChange={(e) =>
                                setConfigValues({ ...configValues, [field.name]: e.target.value })
                            }
                            placeholder={field.placeholder}
                            rows={field.rows || 4}
                            className="scrollbar-thin font-mono text-xs break-all"
                        />
                        {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                        )}
                    </div>
                );

            case 'toggle':
                return (
                    <div key={field.name} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor={field.name}>{field.label}</Label>
                            {field.help && (
                                <p className="text-xs text-muted-foreground">{field.help}</p>
                            )}
                        </div>
                        <Switch
                            id={field.name}
                            checked={(value as boolean) || false}
                            onCheckedChange={(checked) =>
                                setConfigValues({ ...configValues, [field.name]: checked })
                            }
                        />
                    </div>
                );

            case 'select':
                return (
                    <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-destructive ms-1">*</span>}
                        </Label>
                        <Select
                            value={(value as string) || ''}
                            onValueChange={(v) =>
                                setConfigValues({ ...configValues, [field.name]: v })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={field.placeholder || t('Select an option...')} />
                            </SelectTrigger>
                            <SelectContent>
                                {field.options?.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                        )}
                    </div>
                );

            case 'number':
                return (
                    <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-destructive ms-1">*</span>}
                        </Label>
                        <Input
                            id={field.name}
                            type="number"
                            value={value !== undefined && value !== null && value !== '' ? String(value) : ''}
                            onChange={(e) => {
                                const v = e.target.value;
                                setConfigValues({
                                    ...configValues,
                                    [field.name]: v === '' ? '' : Number(v),
                                });
                            }}
                            placeholder={field.placeholder ?? (field.default !== undefined ? String(field.default) : undefined)}
                            min={field.min}
                            max={field.max}
                            step={field.step ?? 1}
                            className={error ? 'border-destructive' : ''}
                        />
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                        {field.help && (
                            <p className="text-xs text-muted-foreground">{field.help}</p>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    const getPluginIcon = (plugin: Plugin) => {
        // Try to match icon from map
        const Icon = iconMap[plugin.icon || ''] || CreditCard;
        return Icon;
    };

    const getStatusBadge = (plugin: Plugin) => {
        const badges = [];

        if (plugin.is_core) {
            badges.push(
                <Badge key="core" variant="outline" className="text-info border-info">
                    <Shield className="h-3 w-3 me-1" />
                    {t('Core plugin')}
                </Badge>
            );
        }

        if (!plugin.is_installed) {
            badges.push(<Badge key="status" variant="secondary">{t('Not Installed')}</Badge>);
        } else if (!plugin.is_configured) {
            badges.push(
                <Badge key="status" variant="outline" className="text-warning border-warning">
                    {t('Not Configured')}
                </Badge>
            );
        } else if (plugin.is_active) {
            badges.push(
                <Badge key="status" variant="default" className="bg-success">
                    {t('Active')}
                </Badge>
            );
        } else {
            badges.push(<Badge key="status" variant="secondary">{t('Inactive')}</Badge>);
        }

        return <div className="flex gap-1 flex-wrap">{badges}</div>;
    };

    const typeLabels: Record<string, string> = {
        payment_gateway: t('Payment Gateways'),
        builder_capability: t('Builder Capabilities'),
        storage_provider: t('Storage Providers'),
        system: t('System'),
    };
    const typeOrder = ['system', 'builder_capability', 'storage_provider', 'payment_gateway'];
    const groupedPlugins = [
        ...typeOrder.map((type) => ({ type, items: plugins.filter((p) => p.type === type) })),
        // Append any plugins whose type isn't in typeOrder so none are dropped.
        {
            type: 'other',
            items: plugins.filter((p) => !typeOrder.includes(p.type)),
        },
    ].filter((g) => g.items.length > 0);

    if (isPageLoading) {
        return (
            <AdminLayout user={auth.user!} title={t('Plugins')}>
                <AdminPageHeader
                    title={t('Plugins')}
                    subtitle={t('Manage installed plugins')}
                    action={
                        <Button onClick={() => setIsUploadModalOpen(true)}>
                            <Upload className="h-4 w-4 me-2" />
                            {t('Upload Plugin')}
                        </Button>
                    }
                />
                <CardGridSkeleton count={6} columns={3} cardVariant="plugin" />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout user={auth.user!} title={t('Plugins')}>
            <AdminPageHeader
                title={t('Plugins')}
                subtitle={t('Manage installed plugins')}
                action={
                    <Button onClick={() => setIsUploadModalOpen(true)}>
                        <Upload className="h-4 w-4 me-2" />
                        {t('Upload Plugin')}
                    </Button>
                }
            />

            <div className="space-y-8">
                {groupedPlugins.map((group) => (
                    <div key={group.type} className="space-y-4">
                        <h2 className="text-lg font-semibold">{typeLabels[group.type] ?? group.type}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {group.items.map((plugin) => {
                                const Icon = getPluginIcon(plugin);
                                return (
                                    <Card key={plugin.slug} className={!plugin.is_active ? 'opacity-75' : ''}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{plugin.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground">
                                                {t('v:version by :author', { version: plugin.version, author: plugin.author })}
                                            </p>
                                        </div>
                                    </div>
                                    {plugin.is_installed && (
                                        <Switch
                                            checked={plugin.is_active}
                                            onCheckedChange={() => handleToggle(plugin)}
                                            disabled={!plugin.is_configured}
                                        />
                                    )}
                                </div>
                                <div className="mt-2">{getStatusBadge(plugin)}</div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">
                                    {plugin.description}
                                </p>
                                {plugin.is_installed && !plugin.is_configured && (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-warning">
                                        <AlertCircle className="h-4 w-4" />
                                        {t('Configuration required')}
                                    </div>
                                )}
                                {plugin.is_installed && plugin.is_configured && (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-success">
                                        <Check className="h-4 w-4" />
                                        {t('Configured')}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="flex gap-2">
                                {!plugin.is_installed ? (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleInstall(plugin)}
                                        disabled={isLoading}
                                    >
                                        <Download className="h-4 w-4 me-2" />
                                        {t('Install')}
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => openConfigDialog(plugin)}
                                        >
                                            <Settings className="h-4 w-4 me-2" />
                                            {t('Configure')}
                                        </Button>
                                        {!plugin.is_core && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => openUninstallDialog(plugin)}
                                                disabled={isLoading}
                                                aria-label={t('Uninstall plugin')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </>
                                )}
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {plugins.length === 0 && (
                <div className="text-center py-12">
                    <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">{t('No plugins available')}</h3>
                    <p className="text-muted-foreground">
                        {t('Installed plugins will appear here. Upload a plugin to get started.')}
                    </p>
                </div>
            )}

            {/* Configure Plugin Dialog */}
            <Dialog open={isConfigDialogOpen} onOpenChange={(open) => {
                setIsConfigDialogOpen(open);
                if (!open) setConfigFormErrors({});
            }}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto overflow-x-hidden scrollbar-thin">
                    <DialogHeader>
                        <DialogTitle>{t('Configure :name', { name: selectedPlugin?.name || '' })}</DialogTitle>
                        <DialogDescription>
                            {selectedPlugin?.config_schema && selectedPlugin.config_schema.length > 0
                                ? t('Enter your plugin configuration settings below.')
                                : t('Review this plugin and close when done.')}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedPlugin?.config_schema && selectedPlugin.config_schema.length > 0 ? (
                        <div className="space-y-4 py-4">
                            {selectedPlugin.config_schema.map((field) => renderConfigField(field))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center py-10">
                            <div className="rounded-full bg-muted p-3 mb-4">
                                <Settings className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">{t('No settings to configure')}</p>
                            <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                                {t("This plugin doesn't expose any configurable settings. It either works out of the box or is controlled through other admin pages (e.g., per-plan toggles).")}
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        {selectedPlugin?.config_schema && selectedPlugin.config_schema.length > 0 ? (
                            <>
                                <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                                    {t('Cancel')}
                                </Button>
                                <Button onClick={handleConfigSave} disabled={isLoading}>
                                    {isLoading ? t('Saving...') : t('Save Configuration')}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={() => setIsConfigDialogOpen(false)}>
                                {t('Close')}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Uninstall Plugin Dialog */}
            <AlertDialog open={isUninstallDialogOpen} onOpenChange={setIsUninstallDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Uninstall :name', { name: selectedPlugin?.name || '' })}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('Are you sure you want to uninstall this plugin? All configuration will be lost.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                // Radix auto-closes on click; keep the dialog open so the
                                // in-flight "Uninstalling..." state is visible (closed in onSuccess).
                                e.preventDefault();
                                handleUninstall();
                            }}
                            disabled={isLoading}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {isLoading ? t('Uninstalling...') : t('Uninstall')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Upload Plugin Modal */}
            <UploadPluginModal
                open={isUploadModalOpen}
                onOpenChange={setIsUploadModalOpen}
            />
        </AdminLayout>
    );
}
