import { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
// markup-templating must load before the PHP grammar.
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import { cn } from '@/lib/utils';

export type CodeLanguage = 'bash' | 'javascript' | 'php' | 'python' | 'json';

interface CodeBlockProps {
    code: string;
    language: CodeLanguage;
    className?: string;
    /**
     * Wrap long lines instead of scrolling horizontally. Use for JSON payloads
     * that contain long unbreakable tokens (URLs, checksums) which would
     * otherwise force a horizontal scrollbar and overflow the viewport.
     */
    wrap?: boolean;
}

/**
 * Syntax-highlighted, read-only code block for the API docs. Prism escapes
 * the source before tokenizing, so the injected HTML is safe.
 */
export function CodeBlock({ code, language, className, wrap = false }: CodeBlockProps) {
    const html = useMemo(() => {
        const grammar = Prism.languages[language];

        return grammar ? Prism.highlight(code, grammar, language) : null;
    }, [code, language]);

    return (
        <pre
            className={cn(
                'code-highlight scrollbar-thin max-w-full rounded-md border bg-muted p-3 text-xs',
                wrap
                    ? 'overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]'
                    : 'overflow-auto',
                className,
            )}
        >
            {html === null ? <code>{code}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
        </pre>
    );
}
