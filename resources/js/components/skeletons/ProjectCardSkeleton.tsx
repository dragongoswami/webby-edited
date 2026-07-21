import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { SkeletonText, SkeletonBadge, SkeletonButton } from '@/components/ui/skeleton-primitives';

interface ProjectCardSkeletonProps extends React.ComponentProps<'div'> {
    /** View mode affects card layout */
    viewMode?: 'large' | 'grid' | 'list';
}

export function ProjectCardSkeleton({
    viewMode = 'grid',
    className,
    ...props
}: ProjectCardSkeletonProps) {
    if (viewMode === 'list') {
        return (
            <Card
                data-testid="project-card-skeleton"
                className={cn('overflow-hidden', className)}
                {...props}
            >
                <div className="flex items-center p-4 gap-4">
                    {/* Thumbnail */}
                    <Skeleton
                        data-testid="project-card-thumbnail-skeleton"
                        className="h-16 w-24 rounded-md flex-shrink-0"
                    />
                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                        <SkeletonText
                            data-testid="project-card-title-skeleton"
                            size="base"
                            width="w-48"
                        />
                        <div className="flex items-center gap-2">
                            <SkeletonText
                                data-testid="project-card-meta-skeleton"
                                size="sm"
                                width="w-24"
                                className="opacity-70"
                            />
                            <SkeletonBadge width="w-14" />
                        </div>
                    </div>
                    {/* Actions */}
                    <SkeletonButton variant="icon" size="sm" />
                </div>
            </Card>
        );
    }

    return (
        <div
            data-testid="project-card-skeleton"
            className={cn('group relative', className)}
            {...props}
        >
            {/* Thumbnail (mirrors the real borderless card: aspect-[4/3] rounded-xl border bg-card) */}
            <Skeleton
                data-testid="project-card-thumbnail-skeleton"
                className="aspect-[4/3] w-full rounded-xl border bg-card mb-3"
            />
            <div>
                {/* Title */}
                <SkeletonText
                    data-testid="project-card-title-skeleton"
                    size="base"
                    width="w-3/4"
                />
                {/* Meta */}
                <SkeletonText
                    data-testid="project-card-meta-skeleton"
                    size="sm"
                    width="w-20"
                    className="mt-1 opacity-70"
                />
            </div>
        </div>
    );
}
