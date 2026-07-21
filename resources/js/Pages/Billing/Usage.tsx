import { useState } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import { usePageLoading } from '@/hooks/usePageLoading';
import { UsageSkeleton } from './UsageSkeleton';
import { ColumnDef } from '@tanstack/react-table';
import AdminLayout from '@/Layouts/AdminLayout';
import { PageProps } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TanStackDataTable } from '@/components/Admin/TanStackDataTable';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Coins,
    Sparkles,
    Key,
    ArrowLeft,
    Infinity as InfinityIcon,
    Bot,
    Plus,
} from 'lucide-react';
import { useAppDate } from '@/lib/date';
import { useTranslation } from '@/contexts/LanguageContext';
import BuyCreditsDialog from '@/components/Billing/BuyCreditsDialog';
import type { CreditPack, CreditPackGateway } from '@/types/billing';

interface UsageRecord {
    id: number;
    project_id: number | null;
    project_name: string | null;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    action: string;
    used_own_api_key: boolean;
    created_at: string;
}

interface PaginatedHistory {
    data: UsageRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface UsageStats {
    credits_remaining: number;
    credits_used: number;
    monthly_limit: number;
    is_unlimited: boolean;
    reset_date: string;
    percentage_used: number;
    purchased_credits?: number;
}

interface Plan {
    name: string;
    monthly_build_credits: number;
    is_unlimited: boolean;
    one_time_credits?: boolean;
    allows_own_api_key: boolean;
}

interface UsageProps extends PageProps {
    stats: UsageStats;
    plan: Plan | null;
    history: PaginatedHistory;
    period: string;
    used_own_api_key: boolean | null;
    creditPacks: CreditPack[];
    creditPackGateways: CreditPackGateway[];
    canBuyCredits: boolean;
}

const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(2)}M`;
    }
    if (tokens >= 1_000) {
        return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return tokens.toLocaleString();
};

// Normalises a raw action key (e.g. "build", "chat_message") into a readable
// label. Casing is handled by the `capitalize` CSS class on the cell.
const formatAction = (action: string) => {
    if (!action) return 'build';
    return action.replace(/_/g, ' ');
};

export default function Usage({ stats, plan, history, period, used_own_api_key, creditPacks, creditPackGateways, canBuyCredits }: UsageProps) {
    const { auth } = usePage<PageProps>().props;
    const { t } = useTranslation();
    const { formatDateTime } = useAppDate();
    const { isLoading } = usePageLoading();
    const [activeTab, setActiveTab] = useState(
        used_own_api_key === true ? 'own-key' : 'plan'
    );
    const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

    const formatCredits = (credits: number) => {
        if (credits >= 1_000_000) {
            return `${(credits / 1_000_000).toFixed(1)}M`;
        }
        if (credits >= 1_000) {
            return `${(credits / 1_000).toFixed(0)}K`;
        }
        return credits.toLocaleString();
    };

    const handlePageChange = (page: number) => {
        router.get(
            route('billing.usage'),
            { page: page + 1, period, used_own_api_key },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        const newUsedOwnApiKey = tab === 'own-key' ? true : false;
        router.get(
            route('billing.usage'),
            {
                period,
                used_own_api_key: newUsedOwnApiKey
            },
            { preserveState: false, preserveScroll: true }
        );
    };

    // Plan usage columns — detailed breakdown of what consumed each credit.
    const planUsageColumns: ColumnDef<UsageRecord>[] = [
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Date')} />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDateTime(row.original.created_at)}
                </span>
            ),
        },
        {
            accessorKey: 'project_name',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Project')} />
            ),
            cell: ({ row }) => {
                const record = row.original;
                return record.project_name ? (
                    <Link
                        href={`/project/${record.project_id}`}
                        className="hover:underline"
                    >
                        {record.project_name}
                    </Link>
                ) : (
                    <span className="text-muted-foreground">-</span>
                );
            },
        },
        {
            accessorKey: 'action',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Action')} />
            ),
            cell: ({ row }) => (
                <Badge variant="secondary" className="font-normal capitalize">
                    {t(formatAction(row.original.action))}
                </Badge>
            ),
        },
        {
            accessorKey: 'prompt_tokens',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Input')} className="text-end" />
            ),
            cell: ({ row }) => (
                <span className="text-end font-mono text-sm text-muted-foreground block">
                    {formatTokens(row.original.prompt_tokens)}
                </span>
            ),
        },
        {
            accessorKey: 'completion_tokens',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Output')} className="text-end" />
            ),
            cell: ({ row }) => (
                <span className="text-end font-mono text-sm text-muted-foreground block">
                    {formatTokens(row.original.completion_tokens)}
                </span>
            ),
        },
        {
            accessorKey: 'total_tokens',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Credits Used')} className="text-end" />
            ),
            cell: ({ row }) => (
                <span className="text-end font-mono text-sm font-medium block">
                    {formatTokens(row.original.total_tokens)}
                </span>
            ),
        },
    ];

    // Own API key usage columns (full details)
    const ownKeyUsageColumns: ColumnDef<UsageRecord>[] = [
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Date')} />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDateTime(row.original.created_at)}
                </span>
            ),
        },
        {
            accessorKey: 'project_name',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Project')} />
            ),
            cell: ({ row }) => {
                const record = row.original;
                return record.project_name ? (
                    <Link
                        href={`/project/${record.project_id}`}
                        className="hover:underline"
                    >
                        {record.project_name}
                    </Link>
                ) : (
                    <span className="text-muted-foreground">-</span>
                );
            },
        },
        {
            accessorKey: 'prompt_tokens',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Input')} className="text-end" />
            ),
            cell: ({ row }) => (
                <span className="text-end font-mono text-sm block">
                    {formatTokens(row.original.prompt_tokens)}
                </span>
            ),
        },
        {
            accessorKey: 'completion_tokens',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Output')} className="text-end" />
            ),
            cell: ({ row }) => (
                <span className="text-end font-mono text-sm block">
                    {formatTokens(row.original.completion_tokens)}
                </span>
            ),
        },
        {
            accessorKey: 'total_tokens',
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title={t('Total')} className="text-end" />
            ),
            cell: ({ row }) => (
                <span className="text-end font-mono text-sm font-medium block">
                    {formatTokens(row.original.total_tokens)}
                </span>
            ),
        },
    ];

    return (
        <AdminLayout user={auth.user!} title={t('Usage')}>
            {isLoading ? (
                <UsageSkeleton />
            ) : (
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="prose prose-sm dark:prose-invert">
                        <h1 className="text-2xl font-bold text-foreground">
                            {t('Usage')}
                        </h1>
                        <p className="text-muted-foreground">{t('Monitor your AI usage and credit balance')}</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/billing">
                            <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Credits Overview */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Coins className="h-4 w-4" />
                                    {t('Credit Balance')}
                                </span>
                                {stats.is_unlimited && (
                                    <Badge variant="secondary" className="gap-1">
                                        <InfinityIcon className="h-3 w-3" />
                                        {t('Unlimited')}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {stats.is_unlimited ? (
                                <div className="text-center py-4">
                                    <div className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
                                        <InfinityIcon className="h-8 w-8" />
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        {t('You have unlimited build credits')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('Remaining')}</span>
                                            <span className="font-medium">
                                                {formatCredits(stats.credits_remaining)} / {formatCredits(stats.monthly_limit)}
                                            </span>
                                        </div>
                                        <Progress value={100 - stats.percentage_used} className="h-2" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">{t('Used this month')}</p>
                                            <p className="font-medium">{formatCredits(stats.credits_used)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t('Resets on')}</p>
                                            <p className="font-medium">{stats.reset_date}</p>
                                        </div>
                                    </div>

                                    {stats.purchased_credits && stats.purchased_credits > 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            {t('Includes :n purchased credits', { n: Number(stats.purchased_credits).toLocaleString() })}
                                        </p>
                                    ) : null}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Current Plan */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                {t('Current Plan')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {plan ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold">{plan.name}</span>
                                        {plan.is_unlimited && (
                                            <Badge variant="default">{t('Unlimited')}</Badge>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Coins className="h-4 w-4 text-muted-foreground" />
                                            <span>
                                                {plan.is_unlimited
                                                    ? t('Unlimited build credits')
                                                    : plan.one_time_credits
                                                        ? t(':count credits (one-time)', { count: plan.monthly_build_credits.toLocaleString() })
                                                        : t(':count credits/month', { count: plan.monthly_build_credits.toLocaleString() })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Key className="h-4 w-4 text-muted-foreground" />
                                            <span>
                                                {plan.allows_own_api_key
                                                    ? t('Can use your own API keys')
                                                    : t('System AI provider only')}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-muted-foreground">
                                        {t('No active subscription')}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Buy Credits CTA */}
                {canBuyCredits && creditPacks.length > 0 && (
                    <Card>
                        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-6">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold flex items-center gap-2">
                                    <Coins className="h-4 w-4" />
                                    {t('Need more credits?')}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('Top up your balance with a one-time credit pack.')}
                                </p>
                            </div>
                            <Button onClick={() => setBuyCreditsOpen(true)}>
                                <Plus className="h-4 w-4 me-2" />
                                {t('Buy Credits')}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Usage History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">{t('Usage History')}</CardTitle>
                        <CardDescription>
                            {t('Every AI build and chat that consumed credits. 1 credit = 1 token (input + output combined).')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Period Filter */}
                        <div className="flex gap-2 mb-4">
                            <Button
                                variant={period === 'current_month' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => router.get(route('billing.usage'), {
                                    period: 'current_month',
                                    used_own_api_key
                                })}
                            >
                                {t('Current Month')}
                            </Button>
                            <Button
                                variant={period === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => router.get(route('billing.usage'), {
                                    period: 'all',
                                    used_own_api_key
                                })}
                            >
                                {t('All Time')}
                            </Button>
                        </div>

                        {/* Tabs for API Key Source */}
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                            <TabsList className="mb-4">
                                <TabsTrigger value="plan">
                                    <Coins className="h-4 w-4 me-2" />
                                    {t('Plan Usage')}
                                </TabsTrigger>
                                <TabsTrigger value="own-key">
                                    <Key className="h-4 w-4 me-2" />
                                    {t('Your API Key Usage')}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="plan" className="space-y-4">
                                {history.data.length > 0 ? (
                                    <TanStackDataTable
                                        columns={planUsageColumns}
                                        data={history.data}
                                        showSearch={false}
                                        serverPagination={{
                                            pageCount: history.last_page,
                                            pageIndex: history.current_page - 1,
                                            pageSize: history.per_page,
                                            total: history.total,
                                            onPageChange: handlePageChange,
                                        }}
                                    />
                                ) : (
                                    <div className="text-center py-12">
                                        <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                        <h3 className="mt-4 text-lg font-semibold">{t('No plan usage')}</h3>
                                        <p className="text-muted-foreground">
                                            {t("Usage from your plan's AI credits will appear here.")}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="own-key" className="space-y-4">
                                {history.data.length > 0 ? (
                                    <TanStackDataTable
                                        columns={ownKeyUsageColumns}
                                        data={history.data}
                                        showSearch={false}
                                        serverPagination={{
                                            pageCount: history.last_page,
                                            pageIndex: history.current_page - 1,
                                            pageSize: history.per_page,
                                            total: history.total,
                                            onPageChange: handlePageChange,
                                        }}
                                    />
                                ) : (
                                    <div className="text-center py-12">
                                        <Bot className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                        <h3 className="mt-4 text-lg font-semibold">{t('No API key usage')}</h3>
                                        <p className="text-muted-foreground">
                                            {t('Usage from your own API keys will appear here.')}
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
            )}

            <BuyCreditsDialog
                open={buyCreditsOpen}
                onOpenChange={setBuyCreditsOpen}
                packs={creditPacks}
                gateways={creditPackGateways}
            />
        </AdminLayout>
    );
}
