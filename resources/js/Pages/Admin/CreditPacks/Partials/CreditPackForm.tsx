import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/contexts/LanguageContext';
import type { PlanOption } from '@/types/billing';

interface CreditPack {
    id?: number;
    name: string;
    description: string | null;
    credits: number;
    bonus_credits: number;
    price: number | string;
    is_active: boolean;
    is_popular: boolean;
    sort_order: number;
    plans?: PlanOption[];
}

interface Props {
    creditPack?: CreditPack;
    plans?: PlanOption[];
    onCancel?: () => void;
}

export default function CreditPackForm({ creditPack, plans = [], onCancel }: Props) {
    const { t } = useTranslation();
    const isEdit = Boolean(creditPack?.id);

    const { data, setData, post, put, processing, errors } = useForm({
        name: creditPack?.name ?? '',
        description: creditPack?.description ?? '',
        credits: creditPack?.credits ?? 0,
        bonus_credits: creditPack?.bonus_credits ?? 0,
        price: creditPack?.price ?? '',
        is_active: creditPack?.is_active ?? true,
        is_popular: creditPack?.is_popular ?? false,
        sort_order: creditPack?.sort_order ?? 0,
        plan_ids: creditPack?.plans?.map((p) => p.id) ?? [] as number[],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            onSuccess: () => toast.success(isEdit ? t('Credit pack updated') : t('Credit pack created')),
            onError: () => toast.error(t('Please fix the errors and try again')),
        };
        if (isEdit) {
            put(route('admin.credit-packs.update', creditPack!.id), opts);
        } else {
            post(route('admin.credit-packs.store'), opts);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            {/* Basic Information */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('Basic Information')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t('Name')} *</Label>
                        <Input
                            id="name"
                            placeholder={t('e.g. Starter, Booster, Mega')}
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className={errors.name ? 'border-destructive' : ''}
                        />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">{t('Description')}</Label>
                        <Textarea
                            id="description"
                            placeholder={t('Brief description of the credit pack')}
                            value={data.description ?? ''}
                            onChange={(e) => setData('description', e.target.value)}
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="credits">{t('Credits (tokens)')} *</Label>
                            <Input
                                id="credits"
                                type="number"
                                min={1}
                                placeholder="1000000"
                                value={data.credits}
                                onChange={(e) => setData('credits', Number(e.target.value))}
                                className={errors.credits ? 'border-destructive' : ''}
                            />
                            {errors.credits && <p className="text-sm text-destructive">{errors.credits}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bonus_credits">{t('Bonus Credits (tokens)')}</Label>
                            <Input
                                id="bonus_credits"
                                type="number"
                                min={0}
                                placeholder="0"
                                value={data.bonus_credits}
                                onChange={(e) => setData('bonus_credits', Number(e.target.value))}
                                className={errors.bonus_credits ? 'border-destructive' : ''}
                            />
                            {errors.bonus_credits && <p className="text-sm text-destructive">{errors.bonus_credits}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="price">{t('Price')} *</Label>
                        <Input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="9.99"
                            value={data.price}
                            onChange={(e) => setData('price', e.target.value)}
                            className={errors.price ? 'border-destructive' : ''}
                        />
                        {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
                        <p className="text-sm text-muted-foreground">
                            {t('Charged in your store currency (set in system settings).')}
                        </p>
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
                                {t('Credit pack is visible and available for purchase')}
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
                                {t('Highlight this credit pack as the recommended option')}
                            </p>
                        </div>
                        <Switch
                            checked={data.is_popular}
                            onCheckedChange={(checked) => setData('is_popular', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Plan Availability */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('Plan Availability')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Label id="credit-pack-available-plans-label">{t('Available Plans')}</Label>
                    <p className="text-xs text-muted-foreground">
                        {t('Leave all unchecked to make this pack available to all plans')}
                    </p>
                    <div className="space-y-2 rounded-lg border p-3 max-h-64 overflow-y-auto" role="group" aria-labelledby="credit-pack-available-plans-label">
                        {plans.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                {t('No plans available')}
                            </p>
                        ) : (
                            plans.map((plan) => (
                                <label key={plan.id} className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={data.plan_ids.includes(plan.id)}
                                        onCheckedChange={(checked) => {
                                            setData(
                                                'plan_ids',
                                                checked
                                                    ? [...data.plan_ids, plan.id]
                                                    : data.plan_ids.filter((id) => id !== plan.id),
                                            );
                                        }}
                                    />
                                    <span className="text-sm">{plan.name}</span>
                                </label>
                            ))
                        )}
                    </div>
                    {errors.plan_ids && <p className="text-sm text-destructive">{errors.plan_ids}</p>}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => (onCancel ? onCancel() : window.history.back())}
                >
                    {t('Cancel')}
                </Button>
                <Button type="submit" disabled={processing}>
                    {processing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    {isEdit ? t('Update Pack') : t('Create Pack')}
                </Button>
            </div>
        </form>
    );
}
