import { cn } from '@/lib/utils';
import { SkeletonAvatar, SkeletonText } from '@/components/ui/skeleton-primitives';

interface TicketThreadSkeletonProps extends React.ComponentProps<'div'> {
    count?: number;
}

/**
 * Placeholder for a ticket conversation timeline while a same-page reload
 * (e.g. message pagination via usePageLoading/useAdminLoading) is in flight.
 */
export function TicketThreadSkeleton({ count = 4, className, ...rest }: TicketThreadSkeletonProps) {
    return (
        <div className={cn('space-y-4', className)} data-testid="ticket-thread-skeleton" {...rest}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex gap-3">
                    <SkeletonAvatar size="md" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <SkeletonText size="sm" width="w-24" />
                            <SkeletonText size="sm" width="w-16" />
                        </div>
                        <SkeletonText width="w-full" />
                        <SkeletonText width="w-4/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}
