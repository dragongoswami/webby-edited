import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';
import { containsMarkdown } from '@/lib/markdown';

interface MarkdownRendererProps {
    content: string;
    className?: string;
    /**
     * Color palette context. `default` renders on card/background surfaces;
     * `onPrimary` renders on a `bg-primary` bubble and uses
     * `primary-foreground` variants so text, code, and links stay legible.
     */
    variant?: 'default' | 'onPrimary';
}

/**
 * Renders markdown or plain text with auto-detection
 * - Auto-detects markdown syntax
 * - Sanitizes HTML for XSS protection
 * - Uses shadcn/ui design tokens via prose classes
 */
export function MarkdownRenderer({ content, className, variant = 'default' }: MarkdownRendererProps) {
    // If no markdown detected, render as plain text
    if (!containsMarkdown(content)) {
        return (
            <p className={cn('text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]', className)}>
                {content}
            </p>
        );
    }

    const palette = variant === 'onPrimary'
        ? [
            'prose-headings:text-primary-foreground',
            'prose-p:text-primary-foreground/95',
            'prose-strong:text-primary-foreground',
            'prose-em:text-primary-foreground',
            'prose-code:bg-primary-foreground/15 prose-code:text-primary-foreground prose-code:border-primary-foreground/20',
            'prose-pre:bg-primary-foreground/10 prose-pre:text-primary-foreground prose-pre:border-primary-foreground/20',
            'prose-a:text-primary-foreground prose-a:underline',
            'prose-ul:text-primary-foreground prose-ol:text-primary-foreground',
            'prose-li:text-primary-foreground prose-li:marker:text-primary-foreground/70',
            'prose-blockquote:text-primary-foreground/90 prose-blockquote:border-primary-foreground/30',
            'prose-hr:border-primary-foreground/20',
        ]
        : [
            'prose-headings:text-foreground',
            'prose-p:text-muted-foreground prose-p:leading-relaxed',
            'prose-strong:text-foreground prose-strong:font-semibold',
            'prose-code:bg-muted prose-code:text-foreground prose-code:border-border',
            'prose-pre:bg-muted prose-pre:border-border',
            'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
            'prose-ul:text-muted-foreground prose-ol:text-muted-foreground',
            'prose-li:marker:text-muted-foreground',
        ];

    return (
        <div className={cn(
            'prose prose-sm max-w-full min-w-0 break-words [overflow-wrap:anywhere]',
            variant === 'default' && 'dark:prose-invert',
            // Force overflow-wrap on every text-bearing prose child so that long
            // unbreakable strings (URLs, comma-glued lists like bg-{a,b,c},
            // long file paths) can't blow out the parent and trigger horizontal
            // overflow inside the radix ScrollArea Viewport.
            'prose-p:[overflow-wrap:anywhere] prose-p:break-words',
            'prose-li:[overflow-wrap:anywhere] prose-li:break-words',
            'prose-headings:[overflow-wrap:anywhere] prose-headings:break-words',
            'prose-headings:font-semibold',
            'prose-code:border prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-medium prose-code:[overflow-wrap:anywhere]',
            'prose-pre:border prose-pre:overflow-x-auto prose-pre:max-w-full',
            'prose-pre:[&_code]:border-0 prose-pre:[&_code]:bg-transparent prose-pre:[&_code]:p-0 prose-pre:[&_code]:font-normal',
            'prose-table:block prose-table:overflow-x-auto',
            ...palette,
            className
        )}>
            <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
