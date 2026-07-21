import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Bot, Loader2, Coins, Key, Globe, Layers } from 'lucide-react';
import FeatureManager, { type PlanFeature } from './FeatureManager';
import type { BillingPeriod } from '@/types/billing';

interface AiProvider {
    id: number;
    name: string;
    type: string;
    is_default: boolean;
}

interface Builder {
    id: number;
    name: string;
}

interface Plan {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    billing_period: BillingPeriod;
    features: PlanFeature[];
    is_active: boolean;
    is_popular: boolean;
    ai_provider_id: number | null;
    fallback_ai_provider_ids: number[] | null;
    builder_id: number | null;
    monthly_build_credits: number | null;
    allow_user_ai_api_key: boolean;
    max_projects: number | null;
    // Subdomain settings
    enable_subdomains: boolean;
    max_subdomains_per_user: number | null;
    allow_private_visibility: boolean;
    // Custom domain settings
    enable_custom_domains: boolean;
    max_custom_domains_per_user: number | null;
    // Web Agent plugin — optional; absent on installs without the webagent plugin
    enable_web_agent?: boolean;
    max_firecrawl_pages_per_month: number | null;
    // File storage settings
    enable_file_storage: boolean;
    max_storage_mb: number | null;
    max_file_size_mb: number;
    allowed_file_types: string[] | null;
    // Database (Supabase) capability
    enable_database?: boolean;
    enable_code_export?: boolean;
    // GitHub capability
    enable_github?: boolean;
    // WordPress theme generation capability
    enable_wordpress?: boolean;
    // Shopify theme generation capability
    enable_shopify?: boolean;
    // Read-only user API (personal API keys)
    enable_api?: boolean;
    // White Label / copyright marking
    enable_white_label?: boolean;
    copyright_text?: string | null;
    // Support tickets
    enable_support_tickets?: boolean;
    max_open_tickets_per_user?: number | null;
    // Trial / one-time plan settings
    single_use?: boolean;
    one_time_credits?: boolean;
}

interface DomainSettings {
    subdomainsEnabled: boolean;
    customDomainsEnabled: boolean;
}

interface PluginCapabilities {
    webAgent?: boolean;
    github?: boolean;
    wordpress?: boolean;
    shopify?: boolean;
}

interface PlanFormProps {
    plan?: Plan;
    aiProviders: AiProvider[];
    builders: Builder[];
    domainSettings?: DomainSettings;
    pluginCapabilities?: PluginCapabilities;
    onCancel: () => void;
}

// Common MIME groups for the per-plan upload allowlist. `null`/empty = allow any
// (dangerous executable types are always blocked server-side regardless).
const FILE_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: 'image/*', label: 'Images' },
    { value: 'video/*', label: 'Videos' },
    { value: 'audio/*', label: 'Audio' },
    { value: 'application/pdf', label: 'PDF documents' },
    { value: 'application/zip', label: 'Archives (ZIP)' },
    { value: 'text/plain', label: 'Plain text' },
];

export default function PlanForm({ plan, aiProviders, builders, domainSettings, pluginCapabilities, onCancel }: PlanFormProps) {
    const { t } = useTranslation();
    const isEdit = !!plan;
    const [isUnlimitedCredits, setIsUnlimitedCredits] = useState(
        plan?.monthly_build_credits === -1
    );

    const { data, setData, post, put, processing, errors } = useForm({
        name: plan?.name ?? '',
        slug: plan?.slug ?? '',
        description: plan?.description ?? '',
        price: plan?.price ?? 0,
        billing_period: plan?.billing_period ?? 'monthly' as BillingPeriod,
        features: plan?.features ?? [] as PlanFeature[],
        is_active: plan?.is_active ?? true,
        is_popular: plan?.is_popular ?? false,
        ai_provider_id: plan?.ai_provider_id ?? null as number | null,
        fallback_ai_provider_ids: plan?.fallback_ai_provider_ids ?? [] as number[],
        builder_id: plan?.builder_id ?? null as number | null,
        monthly_build_credits: plan?.monthly_build_credits ?? 0,
        allow_user_ai_api_key: plan?.allow_user_ai_api_key ?? false,
        max_projects: plan?.max_projects ?? null as number | null,
        // Subdomain settings
        enable_subdomains: plan?.enable_subdomains ?? false,
        max_subdomains_per_user: plan?.max_subdomains_per_user ?? null as number | null,
        allow_private_visibility: plan?.allow_private_visibility ?? false,
        // Custom domain settings
        enable_custom_domains: plan?.enable_custom_domains ?? false,
        max_custom_domains_per_user: plan?.max_custom_domains_per_user ?? null as number | null,
        enable_web_agent: plan?.enable_web_agent ?? false,
        max_firecrawl_pages_per_month: plan?.max_firecrawl_pages_per_month ?? null as number | null,
        // File storage settings
        enable_file_storage: plan?.enable_file_storage ?? false,
        max_storage_mb: plan?.max_storage_mb ?? null as number | null,
        max_file_size_mb: plan?.max_file_size_mb ?? 10,
        allowed_file_types: plan?.allowed_file_types ?? null as string[] | null,
        // Database (Supabase) capability
        enable_database: plan?.enable_database ?? false,
        enable_code_export: plan?.enable_code_export ?? false,
        // GitHub capability
        enable_github: plan?.enable_github ?? false,
        // WordPress theme generation capability
        enable_wordpress: plan?.enable_wordpress ?? false,
        // Shopify theme generation capability
        enable_shopify: plan?.enable_shopify ?? false,
        // Read-only user API (personal API keys)
        enable_api: plan?.enable_api ?? false,
        // White Label / copyright marking
        enable_white_label: plan?.enable_white_label ?? false,
        copyright_text: plan?.copyright_text ?? '',
        // Support tickets
        enable_support_tickets: plan?.enable_support_tickets ?? false,
        max_open_tickets_per_user: plan?.max_open_tickets_per_user ?? null as number | null,
        // Trial / one-time plan settings
        single_use: plan?.single_use ?? false,
        one_time_credits: plan?.one_time_credits ?? false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isEdit) {
            put(route('admin.plans.update', plan.id), {
                onSuccess: () => toast.success(t('Plan updated successfully')),
                onError: () => toast.error(t('Failed to update plan')),
            });
        } else {
            post(route('admin.plans.store'), {
                onSuccess: () => toast.success(t('Plan created successfully')),
                onError: () => toast.error(t('Failed to create plan')),
            });
        }
    };

    const showSubdomains = domainSettings?.subdomainsEnabled !== false;
    const showCustomDomains = domainSettings?.customDomainsEnabled !== false;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* ============ Left Column ============ */}
                <div className="space-y-6">
                    {/* Basic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('Basic Information')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('Plan Name')} *</Label>
                                <Input
                                    id="name"
                                    placeholder={t('e.g. Pro, Business, Enterprise')}
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className={errors.name ? 'border-destructive' : ''}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('Shown to users on the pricing and billing pages.')}
                                </p>
                                {errors.name && (
                                    <p className="text-sm text-destructive">{errors.name}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="slug">{t('Slug')}</Label>
                                <Input
                                    id="slug"
                                    placeholder={t('Auto-generated from the plan name')}
                                    value={data.slug}
                                    onChange={(e) => setData('slug', e.target.value)}
                                    className={errors.slug ? 'border-destructive' : ''}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('Unique identifier used internally. Lowercase letters, numbers and hyphens — leave empty to generate it from the plan name.')}
                                </p>
                                {errors.slug && (
                                    <p className="text-sm text-destructive">{errors.slug}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">{t('Description')}</Label>
                                <Textarea
                                    id="description"
                                    placeholder={t('Brief description of the plan')}
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    rows={2}
                                    className={errors.description ? 'border-destructive' : ''}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('Short summary shown under the plan name on the pricing page.')}
                                </p>
                                {errors.description && (
                                    <p className="text-sm text-destructive">{errors.description}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="price">{t('Price')} *</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="9.99"
                                        value={data.price}
                                        onChange={(e) => setData('price', parseFloat(e.target.value) || 0)}
                                        className={errors.price ? 'border-destructive' : ''}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('In your default currency. Set 0 for a free plan.')}
                                    </p>
                                    {errors.price && (
                                        <p className="text-sm text-destructive">{errors.price}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="billing_period">{t('Billing Period')} *</Label>
                                    <Select
                                        value={data.billing_period}
                                        onValueChange={(value: BillingPeriod) => setData('billing_period', value)}
                                    >
                                        <SelectTrigger id="billing_period">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="monthly">{t('Monthly')}</SelectItem>
                                            <SelectItem value="yearly">{t('Yearly')}</SelectItem>
                                            <SelectItem value="lifetime">{t('Lifetime')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {t('How often users are billed. Lifetime is a one-time payment.')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Display Options */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('Display Options')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Active')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Plan is visible and available for purchase')}
                                    </p>
                                </div>
                                <Switch
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Mark as Popular')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Highlight this plan as the recommended option')}
                                    </p>
                                </div>
                                <Switch
                                    checked={data.is_popular}
                                    onCheckedChange={(checked) => setData('is_popular', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Limits & Credits */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Coins className="h-4 w-4" />
                                {t('Limits & Credits')}
                            </CardTitle>
                            <CardDescription>
                                {t('Project, credit and support quotas for this plan')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Project limit */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Unlimited Projects')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Allow users to create unlimited projects')}
                                    </p>
                                </div>
                                <Switch
                                    checked={data.max_projects === null}
                                    onCheckedChange={(checked) => {
                                        setData('max_projects', checked ? null : 1);
                                    }}
                                />
                            </div>

                            {data.max_projects !== null && (
                                <div className="space-y-2">
                                    <Label htmlFor="max_projects">{t('Maximum Projects')}</Label>
                                    <Input
                                        id="max_projects"
                                        type="number"
                                        min="0"
                                        placeholder="3"
                                        value={data.max_projects}
                                        onChange={(e) => setData('max_projects', parseInt(e.target.value) || 0)}
                                        className={errors.max_projects ? 'border-destructive' : ''}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('Set to 0 for no projects allowed')}
                                    </p>
                                    {errors.max_projects && (
                                        <p className="text-sm text-destructive">{errors.max_projects}</p>
                                    )}
                                </div>
                            )}

                            {/* Build credits */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Unlimited Credits')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Allow unlimited AI usage')}
                                    </p>
                                </div>
                                <Switch
                                    checked={isUnlimitedCredits}
                                    onCheckedChange={(checked) => {
                                        setIsUnlimitedCredits(checked);
                                        setData('monthly_build_credits', checked ? -1 : 0);
                                    }}
                                />
                            </div>

                            {!isUnlimitedCredits && (
                                <div className="space-y-2">
                                    <Label htmlFor="monthly_build_credits">{t('Monthly Token Limit')}</Label>
                                    <Input
                                        id="monthly_build_credits"
                                        type="number"
                                        min="0"
                                        step="1000"
                                        placeholder="1000000"
                                        value={data.monthly_build_credits === -1 ? '' : data.monthly_build_credits}
                                        onChange={(e) => setData('monthly_build_credits', parseInt(e.target.value) || 0)}
                                        className={errors.monthly_build_credits ? 'border-destructive' : ''}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('Credits are tokens — 1 credit = 1 token. The total AI tokens (input + output) a user can use per month, deducted exactly from each AI provider\'s reported token usage.')}
                                    </p>
                                    {errors.monthly_build_credits && (
                                        <p className="text-sm text-destructive">{errors.monthly_build_credits}</p>
                                    )}
                                </div>
                            )}

                            {/* One subscription per user (lifetime) */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Limit to one subscription per user (lifetime)')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Users can only subscribe to this plan once — even after cancelling')}
                                    </p>
                                </div>
                                <Switch
                                    checked={!!data.single_use}
                                    onCheckedChange={(checked) => setData('single_use', checked)}
                                />
                            </div>

                            {/* One-time credit grant */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Grant credits once — no monthly refill')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Credits are granted once at activation and are never reset each month')}
                                    </p>
                                </div>
                                <Switch
                                    checked={!!data.one_time_credits}
                                    onCheckedChange={(checked) => setData('one_time_credits', checked)}
                                />
                            </div>

                            {/* Support tickets */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor="enable_support_tickets" className="cursor-pointer">
                                        {t('Enable support tickets')}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Let users on this plan open support tickets with your team')}
                                    </p>
                                </div>
                                <Switch
                                    id="enable_support_tickets"
                                    checked={!!data.enable_support_tickets}
                                    onCheckedChange={(checked) => setData('enable_support_tickets', checked)}
                                />
                            </div>
                            {data.enable_support_tickets && (
                                <div className="space-y-2">
                                    <Label htmlFor="max_open_tickets_per_user">
                                        {t('Max open tickets per user')}
                                    </Label>
                                    <Input
                                        id="max_open_tickets_per_user"
                                        type="number"
                                        min={0}
                                        placeholder={t('Unlimited')}
                                        value={data.max_open_tickets_per_user ?? ''}
                                        onChange={(e) =>
                                            setData(
                                                'max_open_tickets_per_user',
                                                e.target.value === '' ? null : parseInt(e.target.value, 10),
                                            )
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('Leave blank for unlimited.')}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Access */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                {t('Access')}
                            </CardTitle>
                            <CardDescription>
                                {t('Control API keys and project visibility')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* User API keys */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Allow Own API Keys')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Users can configure their own API keys for AI providers')}
                                    </p>
                                </div>
                                <Switch
                                    checked={data.allow_user_ai_api_key}
                                    onCheckedChange={(checked) => setData('allow_user_ai_api_key', checked)}
                                />
                            </div>
                            {data.allow_user_ai_api_key && (
                                <p className="text-xs text-muted-foreground p-3 bg-muted rounded-md border">
                                    {t('When users provide their own API keys, usage will not be deducted from their credits')}
                                </p>
                            )}

                            {/* Private visibility */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Allow Private Visibility')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Users can set their projects to private (not publicly accessible)')}
                                    </p>
                                </div>
                                <Switch
                                    checked={data.allow_private_visibility}
                                    onCheckedChange={(checked) => setData('allow_private_visibility', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ============ Right Column ============ */}
                <div className="space-y-6">
                    {/* AI Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Bot className="h-4 w-4" />
                                {t('AI Configuration')}
                            </CardTitle>
                            <CardDescription>
                                {t('Choose the AI provider and builder for this plan')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="ai_provider_id">{t('Primary AI Provider')}</Label>
                                <Select
                                    value={data.ai_provider_id?.toString() ?? 'system_default'}
                                    onValueChange={(value) => {
                                        const id = value === 'system_default' ? null : parseInt(value);
                                        setData((prev) => ({
                                            ...prev,
                                            ai_provider_id: id,
                                            // A provider can't be both primary and a fallback of itself.
                                            fallback_ai_provider_ids: (prev.fallback_ai_provider_ids ?? []).filter((fid) => fid !== id),
                                        }));
                                    }}
                                >
                                    <SelectTrigger id="ai_provider_id">
                                        <SelectValue placeholder={t('System Default')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="system_default">{t('System Default')}</SelectItem>
                                        {aiProviders.map((provider) => (
                                            <SelectItem key={provider.id} value={provider.id.toString()}>
                                                {provider.name} ({provider.type})
                                                {provider.is_default && ` - ${t('Default')}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {t('Select which AI provider to use for this plan')}
                                </p>
                            </div>

                            {/* Fallback AI Providers */}
                            <div className="space-y-2">
                                <Label>{t('Fallback AI Providers')}</Label>
                                <p className="text-xs text-muted-foreground">
                                    {t('Tried in order when the primary provider is unavailable')}
                                </p>
                                <div className="space-y-2 rounded-lg border p-3">
                                    {aiProviders.filter((p) => p.id !== data.ai_provider_id).length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            {t('No other providers available')}
                                        </p>
                                    ) : (
                                        aiProviders
                                            .filter((p) => p.id !== data.ai_provider_id)
                                            .map((provider) => (
                                                <label key={provider.id} className="flex items-center gap-2 cursor-pointer">
                                                    <Checkbox
                                                        checked={data.fallback_ai_provider_ids?.includes(provider.id) ?? false}
                                                        onCheckedChange={(checked) => {
                                                            const ids = data.fallback_ai_provider_ids ?? [];
                                                            setData(
                                                                'fallback_ai_provider_ids',
                                                                checked ? [...ids, provider.id] : ids.filter((id) => id !== provider.id),
                                                            );
                                                        }}
                                                    />
                                                    <span className="text-sm">{provider.name} ({provider.type})</span>
                                                </label>
                                            ))
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="builder_id">{t('Primary Builder')}</Label>
                                <Select
                                    value={data.builder_id?.toString() ?? 'system_default'}
                                    onValueChange={(value) =>
                                        setData('builder_id', value === 'system_default' ? null : parseInt(value))
                                    }
                                >
                                    <SelectTrigger id="builder_id">
                                        <SelectValue placeholder={t('System Default')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="system_default">{t('System Default')}</SelectItem>
                                        {builders.map((builder) => (
                                            <SelectItem key={builder.id} value={builder.id.toString()}>
                                                {builder.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {t('Select which builder service to use for this plan')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Capabilities */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                {t('Capabilities')}
                            </CardTitle>
                            <CardDescription>
                                {t('Features projects on this plan can use')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* File Storage */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Enable File Storage')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Allow projects to upload and store files')}
                                    </p>
                                </div>
                                <Switch
                                    checked={data.enable_file_storage}
                                    onCheckedChange={(checked) => setData('enable_file_storage', checked)}
                                />
                            </div>

                            {data.enable_file_storage && (
                                <>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label>{t('Unlimited Storage')}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('Allow unlimited total file storage for each user')}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={data.max_storage_mb === null}
                                            onCheckedChange={(checked) => {
                                                setData('max_storage_mb', checked ? null : 100);
                                            }}
                                        />
                                    </div>

                                    {data.max_storage_mb !== null && (
                                        <div className="space-y-2">
                                            <Label htmlFor="max_storage_mb">{t('Maximum Storage (MB)')}</Label>
                                            <Input
                                                id="max_storage_mb"
                                                type="number"
                                                min="0"
                                                placeholder="100"
                                                value={data.max_storage_mb}
                                                onChange={(e) => setData('max_storage_mb', parseInt(e.target.value) || 0)}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t('Total storage limit per user, across all their projects, in megabytes')}
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="max_file_size_mb">{t('Maximum File Size (MB)')}</Label>
                                        <Input
                                            id="max_file_size_mb"
                                            type="number"
                                            min="1"
                                            max="500"
                                            placeholder="10"
                                            value={data.max_file_size_mb}
                                            onChange={(e) => setData('max_file_size_mb', parseInt(e.target.value) || 10)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {t('Maximum size for individual file uploads')}
                                        </p>
                                    </div>

                                    {/* Allowed file types (empty = allow any) */}
                                    <div className="space-y-2">
                                        <Label>{t('Allowed File Types')}</Label>
                                        <p className="text-xs text-muted-foreground">
                                            {t('Leave all unchecked to allow any file type. Dangerous/executable types are always blocked.')}
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-lg border p-3">
                                            {FILE_TYPE_OPTIONS.map((opt) => (
                                                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                                    <Checkbox
                                                        checked={data.allowed_file_types?.includes(opt.value) ?? false}
                                                        onCheckedChange={(checked) => {
                                                            const cur = data.allowed_file_types ?? [];
                                                            const next = checked
                                                                ? [...cur, opt.value]
                                                                : cur.filter((v) => v !== opt.value);
                                                            setData('allowed_file_types', next.length ? next : null);
                                                        }}
                                                    />
                                                    <span className="text-sm">{t(opt.label)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Database (Supabase) */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Enable Database')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Allow users on this plan to create database-backed apps')}
                                    </p>
                                </div>
                                <Switch
                                    checked={!!data.enable_database}
                                    onCheckedChange={(checked) => setData('enable_database', checked)}
                                />
                            </div>

                            {/* Code Export */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Enable Code Export')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Allow users on this plan to download their project source code (Vercel-ready)')}
                                    </p>
                                </div>
                                <Switch
                                    checked={!!data.enable_code_export}
                                    onCheckedChange={(checked) => setData('enable_code_export', checked)}
                                />
                            </div>

                            {/* White Label / copyright marking */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('White Label')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Remove the copyright mark from exported code, GitHub pushes and published sites for this plan')}
                                    </p>
                                </div>
                                <Switch
                                    checked={!!data.enable_white_label}
                                    onCheckedChange={(checked) => setData('enable_white_label', checked)}
                                />
                            </div>

                            {!data.enable_white_label && (
                                <div className="space-y-2 p-4 border rounded-lg">
                                    <Label htmlFor="copyright_text">{t('Copyright badge HTML')}</Label>
                                    <Textarea
                                        id="copyright_text"
                                        value={data.copyright_text ?? ''}
                                        onChange={(e) => setData('copyright_text', e.target.value)}
                                        rows={3}
                                        maxLength={1000}
                                        placeholder={t('Leave empty to use the default badge built from your site name')}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        {t('Shown on sites built by users on this plan. Scripts and event handlers are stripped on save.')}
                                    </p>
                                    {errors.copyright_text && (
                                        <p className="text-sm text-destructive">{errors.copyright_text}</p>
                                    )}
                                </div>
                            )}

                            {/* GitHub (plugin) */}
                            {pluginCapabilities?.github && (
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label>{t('Enable GitHub')}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {t('Allow users on this plan to connect GitHub and push their project source to a repository')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={!!data.enable_github}
                                        onCheckedChange={(checked) => setData('enable_github', checked)}
                                    />
                                </div>
                            )}

                            {/* WordPress theme generation (plugin) */}
                            {pluginCapabilities?.wordpress && (
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label>{t('Enable WordPress Themes')}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {t('Allow users on this plan to generate installable WordPress block themes')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={!!data.enable_wordpress}
                                        onCheckedChange={(checked) => setData('enable_wordpress', checked)}
                                    />
                                </div>
                            )}

                            {/* Shopify theme generation (plugin) */}
                            {pluginCapabilities?.shopify && (
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="space-y-0.5">
                                        <Label>{t('Enable Shopify Themes')}</Label>
                                        <p className="text-sm text-muted-foreground">
                                            {t('Allow users on this plan to generate installable Shopify Online Store 2.0 themes')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={!!data.enable_shopify}
                                        onCheckedChange={(checked) => setData('enable_shopify', checked)}
                                    />
                                </div>
                            )}

                            {/* User API (personal API keys) */}
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label>{t('Enable API')}</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {t('Allow users on this plan to create API keys and use the read-only account API')}
                                    </p>
                                </div>
                                <Switch
                                    checked={!!data.enable_api}
                                    onCheckedChange={(checked) => setData('enable_api', checked)}
                                />
                            </div>

                            {/* Web Agent (plugin) */}
                            {pluginCapabilities?.webAgent && (
                                <>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label>{t('Enable Web Agent')}</Label>
                                            <p className="text-sm text-muted-foreground">
                                                {t('Allow projects on this plan to use the Web Agent plugin (requires plugin to be installed and active)')}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={!!data.enable_web_agent}
                                            onCheckedChange={(checked) => setData('enable_web_agent', checked)}
                                        />
                                    </div>

                                    {data.enable_web_agent && (
                                        <>
                                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                                <div className="space-y-0.5">
                                                    <Label>{t('Unlimited Firecrawl Pages')}</Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        {t('Allow unlimited monthly Firecrawl page scrapes')}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={data.max_firecrawl_pages_per_month === null}
                                                    onCheckedChange={(checked) => {
                                                        setData('max_firecrawl_pages_per_month', checked ? null : 100);
                                                    }}
                                                />
                                            </div>

                                            {data.max_firecrawl_pages_per_month !== null && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="max_firecrawl_pages_per_month">{t('Max Firecrawl Pages Per Month')}</Label>
                                                    <Input
                                                        id="max_firecrawl_pages_per_month"
                                                        type="number"
                                                        min="0"
                                                        placeholder="100"
                                                        value={data.max_firecrawl_pages_per_month}
                                                        onChange={(e) => setData('max_firecrawl_pages_per_month', parseInt(e.target.value) || 0)}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        {t('Hard monthly cap on Firecrawl page scrapes for users on this plan. 0 = blocked.')}
                                                    </p>
                                                    {errors.max_firecrawl_pages_per_month && (
                                                        <p className="text-sm text-destructive">{errors.max_firecrawl_pages_per_month}</p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Domains */}
                    {(showSubdomains || showCustomDomains) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    {t('Domains')}
                                </CardTitle>
                                <CardDescription>
                                    {t('Allow users to publish projects to subdomains and custom domains')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {showSubdomains && (
                                    <>
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label>{t('Enable Custom Subdomains')}</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('Users can publish projects to custom subdomains')}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={data.enable_subdomains}
                                                onCheckedChange={(checked) => setData('enable_subdomains', checked)}
                                            />
                                        </div>

                                        {data.enable_subdomains && (
                                            <>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-0.5">
                                                        <Label>{t('Unlimited Subdomains')}</Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            {t('Allow unlimited custom subdomains per user')}
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={data.max_subdomains_per_user === null}
                                                        onCheckedChange={(checked) => {
                                                            setData('max_subdomains_per_user', checked ? null : 1);
                                                        }}
                                                    />
                                                </div>

                                                {data.max_subdomains_per_user !== null && (
                                                    <div className="space-y-2">
                                                        <Label htmlFor="max_subdomains">{t('Maximum Subdomains')}</Label>
                                                        <Input
                                                            id="max_subdomains"
                                                            type="number"
                                                            min="0"
                                                            placeholder="5"
                                                            value={data.max_subdomains_per_user ?? ''}
                                                            onChange={(e) => setData('max_subdomains_per_user', parseInt(e.target.value) || 0)}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('Set maximum number of subdomains per user')}
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}

                                {showCustomDomains && (
                                    <>
                                        <div className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label>{t('Enable Custom Domains')}</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    {t('Users can connect their own domains to projects')}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={data.enable_custom_domains}
                                                onCheckedChange={(checked) => setData('enable_custom_domains', checked)}
                                            />
                                        </div>

                                        {data.enable_custom_domains && (
                                            <>
                                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                                    <div className="space-y-0.5">
                                                        <Label>{t('Unlimited Custom Domains')}</Label>
                                                        <p className="text-sm text-muted-foreground">
                                                            {t('Allow unlimited custom domains per user')}
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={data.max_custom_domains_per_user === null}
                                                        onCheckedChange={(checked) => {
                                                            setData('max_custom_domains_per_user', checked ? null : 1);
                                                        }}
                                                    />
                                                </div>

                                                {data.max_custom_domains_per_user !== null && (
                                                    <div className="space-y-2">
                                                        <Label htmlFor="max_custom_domains">{t('Maximum Custom Domains')}</Label>
                                                        <Input
                                                            id="max_custom_domains"
                                                            type="number"
                                                            min="0"
                                                            placeholder="3"
                                                            value={data.max_custom_domains_per_user ?? ''}
                                                            onChange={(e) => setData('max_custom_domains_per_user', parseInt(e.target.value) || 0)}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            {t('Set maximum number of custom domains per user')}
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Features */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('Features')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FeatureManager
                                features={data.features}
                                onChange={(features) => setData('features', features)}
                                error={errors.features}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {isEdit ? t('Save Changes') : t('Create Plan')}
                </Button>
            </div>
        </form>
    );
}
