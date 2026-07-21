// Subscription Types
export type SubscriptionStatus = 'active' | 'pending' | 'expired' | 'cancelled';

export type PaymentMethod =
    | 'paypal'
    | 'bank_transfer'
    | 'manual'
    | 'Stripe'
    | 'Razorpay'
    | 'Paystack'
    | 'Crypto.com'
    | 'YooKassa'
    | 'Referral Credits';

export interface Subscription {
    id: number;
    user_id: number;
    plan_id: number;
    status: SubscriptionStatus;
    amount: number;
    payment_method: PaymentMethod | null;
    external_subscription_id: string | null;
    billing_info: BillingInfo | null;
    approved_by: number | null;
    approved_at: string | null;
    admin_notes: string | null;
    payment_proof: string | null;
    starts_at: string | null;
    renewal_at: string | null;
    ends_at: string | null;
    cancelled_at: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    // Relationships
    user?: User;
    plan?: Plan;
    approvedBy?: User;
    transactions?: Transaction[];
}

export interface BillingInfo {
    name?: string;
    email?: string;
    address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
    };
}

// Transaction Types
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export type TransactionType = 'subscription_new' | 'subscription_renewal' | 'refund' | 'adjustment' | 'extension';

export interface Transaction {
    id: number;
    transaction_id: string;
    external_transaction_id: string | null;
    user_id: number;
    subscription_id: number | null;
    amount: number;
    currency: string;
    status: TransactionStatus;
    type: TransactionType;
    payment_method: PaymentMethod;
    transaction_date: string;
    metadata: TransactionMetadata | null;
    processed_by: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    // Relationships
    user?: User;
    subscription?: Subscription;
    processed_by_user?: User;
}

export interface TransactionMetadata {
    paypal_subscription_id?: string;
    paypal_capture_id?: string;
    bank_transfer_instructions?: string;
    original_transaction_id?: string;
    refund_amount?: number;
    is_full_refund?: boolean;
    [key: string]: unknown;
}

// Plan Types
export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime';

export interface PlanFeature {
    name: string;
    included: boolean;
}

export interface Plan {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    // decimal:2 cast — arrives as a string ("29.00") over the wire
    price: number | string;
    billing_period: BillingPeriod;
    features: (string | PlanFeature)[];
    is_active: boolean;
    is_popular: boolean;
    sort_order: number;
    max_projects: number | null;
    monthly_build_credits: number | null;
    one_time_credits?: boolean;
    allow_user_ai_api_key: boolean;
    // Subdomain settings
    enable_subdomains: boolean;
    max_subdomains_per_user: number | null;
    enable_custom_domains?: boolean;
    max_custom_domains_per_user?: number | null;
    allow_private_visibility: boolean;
    // File storage settings
    enable_file_storage: boolean;
    max_storage_mb: number | null;
    max_file_size_mb: number;
    allowed_file_types: string[] | null;
    // Web Agent plugin (webby-plugin-webagent) — optional, present when the
    // enable_web_agent migration has run. Hidden from the plan form when the
    // plugin is not installed; runtime gate is Plan::webAgentEnabled().
    enable_web_agent?: boolean;
    // Database (Supabase) capability — when enabled, users on this plan can
    // create database-backed apps backed by the configured Supabase project.
    enable_database?: boolean;
    enable_code_export?: boolean;
    enable_github?: boolean;
    enable_wordpress?: boolean;
    enable_shopify?: boolean;
    enable_api?: boolean;
    created_at: string;
    updated_at: string;
}

// Plugin Types
export type PluginType = 'payment_gateway' | 'builder_capability' | 'storage_provider' | 'system';

export type PluginStatus = 'active' | 'inactive';

export interface Plugin {
    id: number | null;
    slug: string;
    name: string;
    description: string;
    type: PluginType;
    version: string;
    author: string;
    icon: string | null;
    is_installed: boolean;
    is_active: boolean;
    is_configured: boolean;
    is_core: boolean;
    config_schema: PluginConfigField[];
    config: Record<string, unknown>;
    migrations?: string[];
}

export interface PluginConfigField {
    name: string;
    label: string;
    type: 'text' | 'password' | 'textarea' | 'toggle' | 'select' | 'readonly' | 'number';
    required?: boolean;
    default?: string | boolean | number;
    placeholder?: string;
    help?: string;
    rows?: number;
    options?: { value: string; label: string }[];
    // Numeric constraints (used by type: 'number')
    min?: number;
    max?: number;
    step?: number;
}

// Payment Gateway Types
export interface PaymentGateway {
    slug: string;
    name: string;
    description: string;
    icon: string;
    supports_auto_renewal: boolean;
    requires_manual_approval: boolean;
}

// Credit Pack Types
export interface PlanOption {
    id: number;
    name: string;
}

export interface CreditPack {
    id: number;
    name: string;
    description: string | null;
    credits: number;
    bonus_credits: number;
    price: number | string;
    currency: string;
    is_popular: boolean;
    plans?: PlanOption[];
}

export interface CreditPackGateway {
    slug: string;
    name: string;
    requires_manual_approval: boolean;
}

// Stats Types
export interface SubscriptionStats {
    total: number;
    active: number;
    pending: number;
    cancelled: number;
    expiring_soon: number;
}

export interface TransactionStats {
    total_revenue: number;
    this_month: number;
    pending_count: number;
    pending_amount: number;
    total_transactions: number;
    refunded: number;
}

export interface PlanStats {
    total_plans: number;
    active_plans: number;
    total_subscribers: number;
}

// Filter Types
export interface SubscriptionFilters {
    status?: SubscriptionStatus;
    plan_id?: number;
    payment_method?: PaymentMethod;
    search?: string;
}

export interface TransactionFilters {
    status?: TransactionStatus;
    type?: TransactionType;
    payment_method?: PaymentMethod;
    date_from?: string;
    date_to?: string;
    search?: string;
}

// Paginated Response Types
export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
}

// Import User from existing types
import { User, PageProps } from './index';

// User Billing Page Props
export interface BillingPageProps extends PageProps {
    subscription: Subscription | null;
    currentPlan: Plan | null;
    pendingSubscription: Subscription | null;
    transactions: PaginatedResponse<Transaction>;
    plans: Plan[];
    paymentGateways: PaymentGateway[];
}
