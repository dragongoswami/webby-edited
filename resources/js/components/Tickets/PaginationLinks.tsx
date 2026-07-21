import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';

type Link = { url: string | null; label: string; active: boolean };

export default function PaginationLinks({ links }: { links: Link[] }) {
    const navigable = links.filter((l) => l.url !== null);
    if (navigable.length <= 3) return null;

    return (
        <nav className="flex flex-wrap items-center gap-1 pt-4" aria-label="Pagination">
            {links.map((link, i) => {
                const className = cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded border px-2 text-sm',
                    link.active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    !link.url && 'pointer-events-none opacity-50',
                );

                if (!link.url) {
                    return (
                        <span
                            key={i}
                            className={className}
                            aria-disabled="true"
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    );
                }
                return (
                    <Link
                        key={i}
                        href={link.url}
                        preserveScroll
                        preserveState
                        className={className}
                        aria-current={link.active ? 'page' : undefined}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                );
            })}
        </nav>
    );
}
