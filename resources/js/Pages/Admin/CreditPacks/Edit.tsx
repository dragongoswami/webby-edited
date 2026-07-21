import { Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CreditPackForm from './Partials/CreditPackForm';
import type { PageProps } from '@/types';
import type { PlanOption } from '@/types/billing';
import { useTranslation } from '@/contexts/LanguageContext';

interface CreditPack {
    id: number;
    name: string;
    description: string | null;
    credits: number;
    bonus_credits: number;
    price: number | string;
    currency: string;
    is_active: boolean;
    is_popular: boolean;
    sort_order: number;
    plans?: PlanOption[];
}

interface EditPageProps extends PageProps {
    creditPack: CreditPack;
    plans: PlanOption[];
}

export default function Edit({ creditPack, plans }: EditPageProps) {
    const { auth } = usePage<EditPageProps>().props;
    const { t } = useTranslation();

    const handleCancel = () => {
        window.history.back();
    };

    return (
        <AdminLayout user={auth.user!} title={t('Edit :name Pack', { name: creditPack.name })}>
            <div className="flex items-center justify-between mb-6">
                <div className="prose prose-sm dark:prose-invert">
                    <h1 className="text-2xl font-bold text-foreground">
                        {t('Edit :name Pack', { name: creditPack.name })}
                    </h1>
                    <p className="text-muted-foreground">{t('Update credit pack configuration')}</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/admin/credit-packs">
                        <ArrowLeft className="h-4 w-4 me-2" />
                        {t('Back')}
                    </Link>
                </Button>
            </div>

            <div>
                <CreditPackForm creditPack={creditPack} plans={plans} onCancel={handleCancel} />
            </div>
        </AdminLayout>
    );
}
