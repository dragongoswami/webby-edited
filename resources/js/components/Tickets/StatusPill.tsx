import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type TicketStatus = 'open' | 'pending' | 'closed';

const statusStyles: Record<TicketStatus, string> = {
    open: 'bg-primary/10 text-primary hover:bg-primary/10',
    pending: 'bg-accent text-accent-foreground hover:bg-accent',
    closed: 'bg-muted text-muted-foreground hover:bg-muted',
};

export default function StatusPill({ status, className }: { status: TicketStatus; className?: string }) {
    const { t } = useTranslation();
    const labels: Record<TicketStatus, string> = {
        open: t('Open'),
        pending: t('Awaiting you'),
        closed: t('Closed'),
    };

    return (
        <Badge variant="secondary" className={cn(statusStyles[status], className)}>
            {labels[status]}
        </Badge>
    );
}
