import { Link, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';
import { buildPlanFeatures, type PluginCapabilityStates } from '@/lib/planFeatures';
import type { PageProps } from '@/types';

interface PlanFeature {
    name: string;
    included: boolean;
}

interface Plan {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    price: string;
    billing_period: 'monthly' | 'yearly' | 'lifetime';
    features: PlanFeature[];
    is_popular: boolean;
    max_projects: number | null;
    monthly_build_credits: number;
    one_time_credits?: boolean;
    allow_user_ai_api_key: boolean;
    // Subdomain settings
    enable_subdomains?: boolean;
    max_subdomains_per_user?: number | null;
    allow_private_visibility?: boolean;
    // Custom domain settings
    enable_custom_domains?: boolean;
    max_custom_domains_per_user?: number | null;
    // Capability flags (derived into the feature list)
    enable_database?: boolean;
    enable_code_export?: boolean;
    enable_github?: boolean;
    enable_wordpress?: boolean;
    enable_shopify?: boolean;
    enable_web_agent?: boolean;
    enable_white_label?: boolean;
    // Read by buildPlanFeatures — keep in sync with Plan::PRICING_COLUMNS
    enable_api?: boolean;
}

interface PricingSectionProps {
    plans: Plan[];
    content?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    pluginCapabilities?: PluginCapabilityStates;
}

type TranslationFn = (key: string, replacements?: Record<string, string | number>) => string;

function PlanCard({ plan, t, currency, pluginCapabilities }: { plan: Plan; t: TranslationFn; currency: string; pluginCapabilities?: PluginCapabilityStates }) {
    const billingPeriodLabels: Record<string, string> = {
        monthly: t('/month'),
        yearly: t('/year'),
        lifetime: '',
    };

    return (
        <Card
            className={cn(
                'flex flex-col relative transition-all hover:shadow-lg',
                plan.is_popular && 'ring-2 ring-primary shadow-lg'
            )}
        >
            {plan.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        {t('Most Popular')}
                    </Badge>
                </div>
            )}
            <CardHeader className={cn('text-center', plan.is_popular && 'pt-6')}>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
                <div className="mt-4">
                    <span className="text-4xl font-bold">{formatCurrency(parseFloat(plan.price), currency)}</span>
                    <span className="text-muted-foreground">
                        {billingPeriodLabels[plan.billing_period]}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="flex-1">
                <ul className="space-y-3">
                    {buildPlanFeatures(plan, t, pluginCapabilities).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                            {feature.included ? (
                                <Check className="h-4 w-4 text-success shrink-0" />
                            ) : (
                                <X className="h-4 w-4 text-destructive shrink-0" />
                            )}
                            <span className={cn(!feature.included && 'text-muted-foreground')}>
                                {feature.name}
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <CardFooter>
                <Button className="w-full" variant={plan.is_popular ? 'default' : 'outline'} asChild>
                    <Link href="/billing/plans">{t('Get Started')}</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

export function PricingSection({ plans, content, pluginCapabilities }: PricingSectionProps) {
    const { t } = useTranslation();
    const currency = usePage<PageProps>().props.appSettings?.default_currency || 'USD';

    if (plans.length === 0) return null;

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Simple, transparent pricing');
    const subtitle = (content?.subtitle as string) || t('Choose the plan that fits your needs. All plans include access to our AI-powered website builder.');

    return (
        <section id="pricing" className="py-16 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-4">
                        {title}
                    </h2>
                    <p className="text-lg text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed">
                        {subtitle}
                    </p>
                </div>

                <div
                    className={cn(
                        'grid gap-6 mx-auto',
                        plans.length === 1 && 'max-w-md grid-cols-1',
                        plans.length === 2 && 'max-w-3xl grid-cols-1 md:grid-cols-2',
                        plans.length >= 3 && 'max-w-5xl grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    )}
                >
                    {plans.map((plan) => (
                        <PlanCard key={plan.id} plan={plan} t={t} currency={currency} pluginCapabilities={pluginCapabilities} />
                    ))}
                </div>
            </div>
        </section>
    );
}
