import { Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CreditPackForm from './Partials/CreditPackForm';
import type { PageProps } from '@/types';
import type { PlanOption } from '@/types/billing';
import { useTranslation } from '@/contexts/LanguageContext';

interface CreatePageProps extends PageProps {
    plans: PlanOption[];
}

export default function Create() {
    const { auth, plans } = usePage<CreatePageProps>().props;
    const { t } = useTranslation();

    const handleCancel = () => {
        window.history.back();
    };

    return (
        <AdminLayout user={auth.user!} title={t('Create Pack')}>
            <div className="flex items-center justify-between mb-6">
                <div className="prose prose-sm dark:prose-invert">
                    <h1 className="text-2xl font-bold text-foreground">
                        {t('Create Pack')}
                    </h1>
                    <p className="text-muted-foreground">{t('Add a new credit pack')}</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/admin/credit-packs">
                        <ArrowLeft className="h-4 w-4 me-2" />
                        {t('Back')}
                    </Link>
                </Button>
            </div>

            <div>
                <CreditPackForm plans={plans} onCancel={handleCancel} />
            </div>
        </AdminLayout>
    );
}
