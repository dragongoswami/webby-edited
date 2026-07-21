import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';

interface ProjectStatusBadgeProps {
    status?: Project['build_status'];
    isTrash?: boolean;
}

export function ProjectStatusBadge({ status, isTrash = false }: ProjectStatusBadgeProps) {
    const { t } = useTranslation();

    if (isTrash) return null;
    if (status !== 'building' && status !== 'failed') return null;

    const isBuilding = status === 'building';

    return (
        <span
            className={cn(
                'absolute top-2 end-12 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm',
                isBuilding
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-destructive text-destructive-foreground',
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full bg-current',
                    isBuilding && 'animate-pulse',
                )}
            />
            {isBuilding ? t('Building') : t('Failed')}
        </span>
    );
}
