import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { AppPageHeader } from '@/components/Header/AppPageHeader';
import { Toaster } from '@/components/ui/sonner';
import { EndpointSection } from '@/components/ApiDocs/EndpointSection';
import { API_ENDPOINTS } from '@/lib/apiCatalog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    Search,
    BookOpen,
    KeyRound,
    Loader2,
    User as UserIcon,
    Coins,
    BadgeCheck,
    FolderOpen,
    Files,
    FileText,
    Bell,
    ReceiptText,
} from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import type { User } from '@/types';

interface ApiDocsPageProps {
    auth: {
        user: User;
    };
    apiBaseUrl: string;
}

const ERROR_ROWS: Array<{ code: number; descriptionKey: string }> = [
    { code: 401, descriptionKey: 'Missing or invalid API key.' },
    { code: 403, descriptionKey: 'Your plan does not include API access, or the key lacks the required ability.' },
    { code: 404, descriptionKey: 'The requested resource does not exist or is not yours.' },
    { code: 429, descriptionKey: 'Too many requests. Retry after the time given in the Retry-After header.' },
];

interface DocsSection {
    key: string;
    label: string;
    icon: React.ReactNode;
    keywords: string[];
    category: 'getting-started' | 'endpoints';
}

const ENDPOINT_ICONS: Record<string, React.ReactNode> = {
    'me': <UserIcon className="h-4 w-4" />,
    'credits': <Coins className="h-4 w-4" />,
    'subscription': <BadgeCheck className="h-4 w-4" />,
    'projects': <FolderOpen className="h-4 w-4" />,
    'project-detail': <FileText className="h-4 w-4" />,
    'project-files': <Files className="h-4 w-4" />,
    'project-file-detail': <FileText className="h-4 w-4" />,
    'notifications': <Bell className="h-4 w-4" />,
    'invoices': <ReceiptText className="h-4 w-4" />,
};

const ENDPOINT_KEYWORDS: Record<string, string[]> = {
    'me': ['me', 'user', 'profile', 'account', 'email', 'locale', 'plan'],
    'credits': ['credits', 'balance', 'usage', 'tokens', 'limit', 'reset'],
    'subscription': ['subscription', 'plan', 'billing', 'renewal', 'status'],
    'projects': ['projects', 'list', 'sites', 'pagination', 'published'],
    'project-detail': ['project', 'detail', 'single', 'uuid', 'id'],
    'project-files': ['files', 'uploads', 'storage', 'attachments', 'media'],
    'project-file-detail': ['file', 'upload', 'attachment', 'detail', 'media'],
    'notifications': ['notifications', 'alerts', 'messages', 'unread'],
    'invoices': ['invoices', 'payments', 'transactions', 'billing', 'receipts'],
};

export default function ApiDocsIndex({ auth, apiBaseUrl }: ApiDocsPageProps) {
    const user = auth.user;
    const { t } = useTranslation();

    // Held in memory only — never persisted to storage or sent anywhere except
    // as the Authorization header of tester requests.
    const [apiKey, setApiKey] = useState('');
    const [generating, setGenerating] = useState(false);

    // Build sections array: overview + one entry per endpoint
    const sections: DocsSection[] = [
        {
            key: 'overview',
            label: t('Overview'),
            icon: <BookOpen className="h-4 w-4" />,
            keywords: ['overview', 'authentication', 'base url', 'bearer', 'rate', 'errors', 'key', 'token'],
            category: 'getting-started',
        },
        ...API_ENDPOINTS.map((e) => ({
            key: e.id,
            label: t(e.titleKey),
            icon: ENDPOINT_ICONS[e.id],
            keywords: [...(ENDPOINT_KEYWORDS[e.id] ?? []), e.path],
            category: 'endpoints' as const,
        })),
    ];

    // Get initial section from URL params (mirrors Settings' getInitialTab)
    const getInitialSection = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const section = params.get('section');
            if (section && sections.some((s) => s.key === section)) {
                return section;
            }
        }
        return 'overview';
    };

    const [activeSection, setActiveSection] = useState(getInitialSection);
    const [search, setSearch] = useState('');

    const handleSectionChange = (key: string) => {
        setActiveSection(key);
        const url = key === 'overview' ? '/api-docs' : `/api-docs?section=${key}`;
        window.history.replaceState({}, '', url);
    };

    const matchesSearch = (section: DocsSection) => {
        if (!search.trim()) return true;
        const terms = search.toLowerCase().trim().split(/\s+/);
        return terms.every(
            (term) =>
                section.keywords.some((kw) => kw.toLowerCase().includes(term)) ||
                section.label.toLowerCase().includes(term),
        );
    };

    const getSectionsByCategory = (category: 'getting-started' | 'endpoints') =>
        sections.filter((s) => s.category === category && matchesSearch(s));

    const hasResults = sections.some(matchesSearch);

    const generateTestKey = async () => {
        setGenerating(true);
        try {
            const response = await axios.post(route('api-docs.test-key'));
            setApiKey(response.data.token);
            toast.success(t('Test key generated. It expires in 1 hour.'));
        } catch {
            toast.error(t('Failed to generate test key'));
        } finally {
            setGenerating(false);
        }
    };

    const renderOverview = () => (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{t('Authentication')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h4 className="text-sm font-semibold mb-1">{t('Base URL')}</h4>
                    <code className="rounded-md border bg-muted px-2 py-1 font-mono text-sm">
                        {apiBaseUrl}
                    </code>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t('Send your API key as a Bearer token in the Authorization header. Create keys on the API Keys page.')}{' '}
                    <Link href={route('api-keys.index')} className="underline">
                        {t('API Keys')}
                    </Link>
                </p>
                <p className="text-sm text-muted-foreground">
                    {t('Keys can be created with an optional expiry (30, 90, or 365 days). An expired key returns 401, the same as an invalid key.')}
                </p>
                <div>
                    <h4 className="text-sm font-semibold mb-1">{t('Rate limiting')}</h4>
                    <p className="text-sm text-muted-foreground">
                        {t('Requests are rate limited per key. The current limits are returned in the X-RateLimit-* response headers.')}
                    </p>
                </div>
                <div>
                    <h4 className="text-sm font-semibold mb-1">{t('Errors')}</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                        {t('The API returns conventional HTTP status codes.')}
                    </p>
                    <div className="rounded-md border overflow-x-auto">
                        <table className="w-full text-sm">
                            <tbody>
                                {ERROR_ROWS.map((row) => (
                                    <tr key={row.code} className="border-b last:border-0">
                                        <td className="px-3 py-2 font-mono text-xs w-16">{row.code}</td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {t(row.descriptionKey)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    // Persistent across every section: the in-memory API key used by all the
    // endpoint testers, so the key field is always reachable (and "above" the
    // "Send request" button) no matter which section is active.
    const renderApiKeyCard = () => (
        <Card>
            <CardContent className="space-y-2 pt-6">
                <Label htmlFor="docs_api_key">{t('Your API key')}</Label>
                <div className="flex gap-2">
                    <Input
                        id="docs_api_key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk_..."
                        autoComplete="off"
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={generateTestKey}
                        disabled={generating}
                        className="shrink-0"
                    >
                        {generating ? (
                            <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        ) : (
                            <KeyRound className="h-4 w-4 me-2" />
                        )}
                        {t('Generate test key')}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {t('Paste your API key to try requests from this page. The key is kept in memory only and never stored.')}
                </p>
                <p className="text-xs text-muted-foreground">
                    {t('Temporary keys expire after 1 hour. Manage permanent keys on the API Keys page.')}
                </p>
            </CardContent>
        </Card>
    );

    const renderContent = () => {
        if (activeSection === 'overview') {
            return renderOverview();
        }

        const endpoint = API_ENDPOINTS.find((e) => e.id === activeSection);
        if (!endpoint) {
            return renderOverview();
        }

        // key={endpoint.id} forces a fresh EndpointSection/EndpointTester per
        // endpoint so a previous "Send request" result (and typed params) don't
        // linger when switching sections.
        return (
            <EndpointSection key={endpoint.id} endpoint={endpoint} baseUrl={apiBaseUrl} apiKey={apiKey} />
        );
    };

    return (
        <>
            <Head title={t('API Documentation')} />
            <Toaster />

            <TooltipProvider>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset>
                        <div className="min-h-screen bg-background">
                            <AppPageHeader user={user} />

                            <main className="p-4 md:p-6 lg:p-8">
                                <div className="max-w-7xl mx-auto space-y-6">
                                    <div>
                                        <h1 className="text-2xl font-bold text-foreground">
                                            {t('API Documentation')}
                                        </h1>
                                        <p className="text-muted-foreground mt-1">
                                            {t('Read-only REST API for your account data. Authenticate every request with an API key.')}
                                        </p>
                                    </div>

                                    <div className="flex flex-col lg:flex-row gap-6">
                                        {/* Sidebar Navigation */}
                                        <div className="w-full lg:w-64 flex-shrink-0">
                                            <Card className="lg:sticky lg:top-20 py-0">
                                                <CardContent className="p-0">
                                                    {/* Search */}
                                                    <div className="px-4 pt-6 pb-3 border-b">
                                                        <div className="relative">
                                                            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input
                                                                type="text"
                                                                value={search}
                                                                onChange={(e) => setSearch(e.target.value)}
                                                                className="ps-9"
                                                                placeholder={t('Search documentation...')}
                                                                aria-label={t('Search endpoints')}
                                                                autoComplete="off"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Navigation */}
                                                    <nav className="px-4 py-4 space-y-4 max-h-96 lg:max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
                                                        {hasResults ? (
                                                            <>
                                                                {/* Getting Started Category */}
                                                                {getSectionsByCategory('getting-started').length > 0 && (
                                                                    <div>
                                                                        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                                                                            {t('Getting started')}
                                                                        </p>
                                                                        <ul className="space-y-1">
                                                                            {getSectionsByCategory('getting-started').map((section) => (
                                                                                <li key={section.key}>
                                                                                    <button
                                                                                        onClick={() => handleSectionChange(section.key)}
                                                                                        type="button"
                                                                                        className={cn(
                                                                                            'flex items-center gap-2 p-2 w-full rounded-lg text-sm font-medium transition-colors text-start rounded-md focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
                                                                                            activeSection === section.key
                                                                                                ? 'bg-primary text-primary-foreground'
                                                                                                : 'text-foreground hover:bg-muted',
                                                                                        )}
                                                                                    >
                                                                                        {section.icon}
                                                                                        <span>{section.label}</span>
                                                                                    </button>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}

                                                                {/* Endpoints Category */}
                                                                {getSectionsByCategory('endpoints').length > 0 && (
                                                                    <div>
                                                                        <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
                                                                            {t('Endpoints')}
                                                                        </p>
                                                                        <ul className="space-y-1">
                                                                            {getSectionsByCategory('endpoints').map((section) => (
                                                                                <li key={section.key}>
                                                                                    <button
                                                                                        onClick={() => handleSectionChange(section.key)}
                                                                                        type="button"
                                                                                        className={cn(
                                                                                            'flex items-center gap-2 p-2 w-full rounded-lg text-sm font-medium transition-colors text-start rounded-md focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
                                                                                            activeSection === section.key
                                                                                                ? 'bg-primary text-primary-foreground'
                                                                                                : 'text-foreground hover:bg-muted',
                                                                                        )}
                                                                                    >
                                                                                        {section.icon}
                                                                                        <span>{section.label}</span>
                                                                                    </button>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                                {t('No results found for ":search"', { search })}
                                                            </p>
                                                        )}
                                                    </nav>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Main Content */}
                                        <div className="flex-1 min-w-0 space-y-6">
                                            {renderApiKeyCard()}
                                            {renderContent()}
                                        </div>
                                    </div>
                                </div>
                            </main>
                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>
        </>
    );
}
