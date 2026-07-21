import { Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { AdminPageHeader } from '@/components/Admin/AdminPageHeader';
import { useAdminLoading } from '@/hooks/useAdminLoading';
import { CardGridSkeleton } from '@/components/Admin/skeletons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Star, Coins, GripVertical } from 'lucide-react';
import type { PageProps } from '@/types';
import type { PlanOption } from '@/types/billing';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CreditPack {
    id: number;
    name: string;
    slug: string;
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

interface CreditPacksPageProps extends PageProps {
    creditPacks: CreditPack[];
    stats: {
        total_packs: number;
        active_packs: number;
    };
    filters: {
        search?: string;
        status?: string;
    };
}

interface SortableCreditPackCardProps {
    creditPack: CreditPack;
    onDelete: (creditPack: CreditPack) => void;
    onToggleStatus: (creditPack: CreditPack) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    locale: string;
}

function SortableCreditPackCard({ creditPack, onDelete, onToggleStatus, t, locale }: SortableCreditPackCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: creditPack.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card
                className={`flex flex-col ${!creditPack.is_active ? 'opacity-60' : ''} ${creditPack.is_popular ? 'ring-2 ring-primary' : ''} ${isDragging ? 'shadow-lg' : ''}`}
            >
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t('Drag to reorder')}
                                    className="size-7 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                    {...attributes}
                                    {...listeners}
                                >
                                    <GripVertical className="h-5 w-5" />
                                </Button>
                                <CardTitle className="text-lg">{creditPack.name}</CardTitle>
                                {creditPack.is_popular && (
                                    <Star className="h-4 w-4 fill-primary text-primary" />
                                )}
                            </div>
                            <div className="flex gap-2 mt-2">
                                {!creditPack.is_active && <Badge variant="secondary">{t('Inactive')}</Badge>}
                            </div>
                        </div>
                    </div>
                    {creditPack.description && (
                        <p className="text-sm text-muted-foreground mt-2">{creditPack.description}</p>
                    )}
                    <div className="mt-4">
                        <span className="text-3xl font-bold">
                            {formatCurrency(Number(creditPack.price), creditPack.currency, locale)}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Coins className="h-4 w-4 text-primary flex-shrink-0" />
                        <span>
                            {creditPack.credits.toLocaleString()} {t('tokens')}
                            {creditPack.bonus_credits > 0 && (
                                <span className="text-success">
                                    {' '}+ {creditPack.bonus_credits.toLocaleString()} {t('bonus')}
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {creditPack.plans && creditPack.plans.length > 0 ? (
                            creditPack.plans.map((plan) => (
                                <Badge key={plan.id} variant="outline">{plan.name}</Badge>
                            ))
                        ) : (
                            <Badge variant="secondary">{t('All plans')}</Badge>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link href={`/admin/credit-packs/${creditPack.id}/edit`}>
                            <Pencil className="h-4 w-4 me-1" />
                            {t('Edit')}
                        </Link>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleStatus(creditPack)}
                    >
                        {creditPack.is_active ? t('Deactivate') : t('Activate')}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label={t('Delete credit pack')}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(creditPack)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function Index({ auth, creditPacks }: CreditPacksPageProps) {
    const { t, locale } = useTranslation();
    const { isLoading } = useAdminLoading();
    const [packItems, setPackItems] = useState<CreditPack[]>(creditPacks);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [packToDelete, setPackToDelete] = useState<CreditPack | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPackItems((items) => {
                const snapshot = items;
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                const updatedPacks = newItems.map((pack, index) => ({
                    id: pack.id,
                    sort_order: index,
                }));

                fetch(route('admin.credit-packs.reorder'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({ creditPacks: updatedPacks }),
                })
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('Failed to reorder credit packs');
                        }
                        return response.json();
                    })
                    .then((data) => {
                        if (!data.success) {
                            throw new Error('Failed to reorder credit packs');
                        }
                        toast.success(t('Credit packs reordered'));
                    })
                    .catch(() => {
                        toast.error(t('Failed to reorder credit packs'));
                        setPackItems(snapshot); // Revert on error
                    });

                return newItems;
            });
        }
    };

    const handleDelete = (creditPack: CreditPack) => {
        setPackToDelete(creditPack);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (!packToDelete) return;
        router.delete(route('admin.credit-packs.destroy', packToDelete.id), {
            onSuccess: () => {
                toast.success(t('Credit pack deleted'));
                setPackItems((items) => items.filter((item) => item.id !== packToDelete.id));
                setIsDeleteDialogOpen(false);
                setPackToDelete(null);
            },
            onError: (errors) => {
                const message = Object.values(errors)[0] as string;
                toast.error(message || t('Failed to delete credit pack'));
            },
        });
    };

    const handleToggleStatus = (creditPack: CreditPack) => {
        router.post(
            route('admin.credit-packs.toggle-status', creditPack.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(creditPack.is_active ? t('Credit pack deactivated') : t('Credit pack activated'));
                    setPackItems((items) =>
                        items.map((item) =>
                            item.id === creditPack.id
                                ? { ...item, is_active: !item.is_active }
                                : item
                        )
                    );
                },
            }
        );
    };

    if (isLoading) {
        return (
            <AdminLayout user={auth.user!} title={t('Credit Packs')}>
                <AdminPageHeader
                    title={t('Credit Packs')}
                    subtitle={t('Manage credit packs')}
                    action={
                        <Button asChild>
                            <Link href={route('admin.credit-packs.create')}>
                                <Plus className="h-4 w-4 me-2" />
                                {t('Create Pack')}
                            </Link>
                        </Button>
                    }
                />
                <CardGridSkeleton count={4} columns={4} cardVariant="plan" />
            </AdminLayout>
        );
    }

    return (
        <AdminLayout user={auth.user!} title={t('Credit Packs')}>
            <AdminPageHeader
                title={t('Credit Packs')}
                subtitle={t('Manage credit packs')}
                action={
                    <Button asChild>
                        <Link href={route('admin.credit-packs.create')}>
                            <Plus className="h-4 w-4 me-2" />
                            {t('Create Pack')}
                        </Link>
                    </Button>
                }
            />

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={packItems.map((pack) => pack.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {packItems.map((pack) => (
                            <SortableCreditPackCard
                                key={pack.id}
                                creditPack={pack}
                                onDelete={handleDelete}
                                onToggleStatus={handleToggleStatus}
                                t={t}
                                locale={locale}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {packItems.length === 0 && (
                <div className="text-center py-12">
                    <Coins className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">{t('No credit packs yet')}</h3>
                    <p className="text-muted-foreground">
                        {t('Get started by creating your first credit pack.')}
                    </p>
                    <Button className="mt-4" asChild>
                        <Link href={route('admin.credit-packs.create')}>
                            <Plus className="h-4 w-4 me-2" />
                            {t('Create Pack')}
                        </Link>
                    </Button>
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => {
                setIsDeleteDialogOpen(open);
                if (!open) setPackToDelete(null);
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('Are you sure you want to delete this credit pack?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This action cannot be undone. This will permanently delete the credit pack.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {t('Delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AdminLayout>
    );
}
