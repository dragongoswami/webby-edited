import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { formatCurrency as formatCurrencyUtil } from '@/lib/currency';
import type { Plan } from '@/types/billing';
import type { PageProps } from '@/types';

interface NoSubscriptionAlertProps {
    /**
     * The user's current plan when they have no active subscription but were
     * assigned a (typically free) default plan at registration. When present,
     * Billing shows the plan instead of the "no subscription" prompt.
     */
    plan?: Plan | null;
}

export default function NoSubscriptionAlert({ plan }: NoSubscriptionAlertProps) {
    const { t, locale } = useTranslation();
    const { appSettings } = usePage<PageProps>().props;
    const currency = appSettings?.default_currency || 'USD';

    const billingPeriodLabels: Record<string, string> = {
        monthly: t('/month'),
        yearly: t('/year'),
        lifetime: t(' one-time'),
    };

    if (plan) {
        return (
            <Card>
                <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col items-center text-center">
                        <div className="p-3 bg-primary/10 rounded-full mb-4">
                            <Sparkles className="h-8 w-8 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">{t('Current Plan')}</p>
                        <h3 className="text-xl font-semibold mb-1">{plan.name}</h3>
                        <p className="text-2xl font-bold">
                            {formatCurrencyUtil(Number(plan.price), currency, locale)}
                            {plan.billing_period !== 'lifetime' && (
                                <span className="text-sm font-normal text-muted-foreground">
                                    {billingPeriodLabels[plan.billing_period] || billingPeriodLabels.monthly}
                                </span>
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-primary/10 rounded-full mb-4">
                        <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t('No Active Subscription')}</h3>
                    <p className="text-muted-foreground max-w-md">
                        {t('Choose a plan to get started with building your projects.')}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
