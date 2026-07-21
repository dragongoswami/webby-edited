import type { DesignSystemOption } from './design';

export type { DesignSystemOption };

export type UserRole = 'admin' | 'user';

/** A user's Supabase BYOD connection, as exposed to the Create page picker. */
export interface SupabaseConnectionOption {
    id: number;
    label: string;
}

export interface GithubConnectionOption {
    id: number;
    label: string;
    github_login: string;
}

export interface ShopifyConnectionOption {
    id: number;
    label: string;
    shop_domain: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    role: UserRole;
    email_verified_at?: string;
}

export interface Project {
    id: string;
    name: string;
    description: string | null;
    thumbnail: string | null;
    preview_url?: string | null;
    output_target?: 'website' | 'wordpress_theme' | 'shopify_theme';
    is_public: boolean;
    is_starred: boolean;
    status: 'draft' | 'published' | 'archived';
    build_status?: 'idle' | 'building' | 'completed' | 'failed';
    last_viewed_at: string | null;
    updated_at: string;
    deleted_at?: string | null;
    subdomain?: string | null;
    custom_domain?: string | null;
    user?: User;
    pivot?: {
        permission: 'view' | 'edit' | 'admin';
    };
}

// The shared recentProjects prop is deliberately narrow: the backend selects
// only the columns the sidebar renders (HandleInertiaRequests).
export type RecentProject = Pick<Project, 'id' | 'name'>;

export type ProjectTab = 'all' | 'favorites' | 'trash';
export type ProjectSort = 'last-edited' | 'name' | 'created';
export type ProjectVisibility = 'public' | 'private';

export interface ProjectFilters {
    search?: string | null;
    sort: ProjectSort;
    visibility?: ProjectVisibility | null;
}

export interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface ProjectCounts {
    all: number;
    favorites: number;
    trash: number;
}

export interface ProjectsPageProps extends PageProps {
    projects: PaginatedData<Project>;
    counts: ProjectCounts;
    activeTab: ProjectTab;
    filters: ProjectFilters;
    baseDomain?: string;
}

export interface Template {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    thumbnail: string | null;
    is_system: boolean;
    output_target?: 'website' | 'wordpress_theme' | 'shopify_theme';
    plans?: Plan[];
    plan_ids?: number[];
}

export type ColorTheme = 'neutral' | 'blue' | 'green' | 'orange' | 'red' | 'rose' | 'violet' | 'yellow';

export type RealtimeProvider = 'sse' | 'pusher';

export interface AppSettings {
    site_name: string;
    site_tagline: string;
    site_description: string;
    site_logo: string | null;
    site_logo_dark: string | null;
    site_favicon: string | null;
    default_theme: 'light' | 'dark' | 'system';
    color_theme: ColorTheme;
    default_locale: string;
    timezone: string;
    date_format: string;
    landing_page_enabled: boolean;
    cookie_consent_enabled: boolean;
    enable_registration: boolean;
    google_login_enabled: boolean;
    facebook_login_enabled: boolean;
    github_login_enabled: boolean;
    recaptcha_enabled: boolean;
    recaptcha_site_key: string;
    realtime_provider: RealtimeProvider;
    pusher_key: string;
    pusher_cluster: string;
    referral_enabled: boolean;
    default_currency: string;
    currency_symbol: string;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User | null;
    };
    flash: {
        success: string | null;
        error: string | null;
    };
    appSettings: AppSettings;
    recentProjects: RecentProject[] | null;
    hasUpgradablePlans: boolean;
    databaseEnabled: boolean;
    canUseGithub: boolean;
    canUseShopify: boolean;
    canConnectShopify: boolean;
    canUseApi: boolean;
    fileStorageEnabled: boolean;
    isDemo?: boolean;
    isLocal?: boolean;
    userCredits: {
        remaining: number;
        monthlyLimit: number;
        isUnlimited: boolean;
        usingOwnKey: boolean;
    } | null;
    unreadNotificationCount: number;
    impersonating: true | null;
};

export interface CreateProps extends PageProps {
    user: User;
    templates: Template[];
    designSystems: DesignSystemOption[];
    supabaseConnections: SupabaseConnectionOption[];
    githubConnections: GithubConnectionOption[];
    shopifyConnections: ShopifyConnectionOption[];
    wordpressEnabled: boolean;
    shopifyEnabled: boolean;
    isPusherConfigured: boolean;
    canCreateProject: boolean;
    cannotCreateReason: string | null;
    suggestions: string[];
    typingPrompts: string[];
    greeting: string;
}
