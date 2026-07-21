import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: ReactNode;
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    variant?: 'card' | 'plain';
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    variant = 'plain',
    className,
}: EmptyStateProps) {
    const isCard = variant === 'card';

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                isCard
                    ? 'py-24 border-2 border-dashed border-muted-foreground/25 rounded-xl bg-muted/20'
                    : 'py-12',
                className
            )}
        >
            {icon && <div className="mb-4 text-muted-foreground/30">{icon}</div>}
            {title && (
                <h3
                    className={cn(
                        'font-medium text-muted-foreground',
                        isCard ? 'text-lg mb-2' : 'text-base'
                    )}
                >
                    {title}
                </h3>
            )}
            {description && (
                <p
                    className={cn(
                        'text-sm max-w-md',
                        isCard ? 'text-muted-foreground/70' : 'text-muted-foreground'
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
