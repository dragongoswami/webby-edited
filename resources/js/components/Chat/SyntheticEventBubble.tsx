import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';

/**
 * SyntheticEventBubble renders a compact "something happened" entry in the
 * chat transcript. Used for user-triggered actions whose underlying payload
 * is a long, machine-generated instruction — theme preset apply, Style
 * panel apply, AI Edit, Save All. Without this, clicking any of those dumps
 * a 3 KB+ instruction block into chat as if the user had typed it, which
 * looks like noise.
 *
 * Shape: left-aligned icon + one-line title, optional muted details line,
 * and an expand chevron that reveals the raw prompt content for debugging /
 * transparency. Matches the visual language of the existing activity
 * variant in MessageBubble.tsx (L132-142) so the whole "machine-generated
 * event" family reads as one category.
 */
interface SyntheticEventBubbleProps {
    icon: string; // emoji, e.g. "🎨"
    title: string; // one-line label — already translated, ready to render
    details?: string; // optional second line, muted
    rawContent: string; // full original message content, shown on expand
}

function SyntheticEventBubble({ icon, title, details, rawContent }: SyntheticEventBubbleProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="flex justify-start animate-fade-in">
            <div className="flex flex-col gap-1 min-w-0 max-w-[85%] py-1">
                <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    aria-label={expanded ? t('Hide details') : t('Show details')}
                    aria-expanded={expanded}
                    className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors text-start"
                >
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">
                        {icon}
                    </span>
                    <span className="truncate italic">{title}</span>
                    {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    )}
                </button>
                {details && !expanded && (
                    <div className="ps-8 text-xs text-muted-foreground/80 truncate">{details}</div>
                )}
                {expanded && (
                    <pre
                        className={cn(
                            'ms-8 mt-1 px-3 py-2 rounded-md bg-muted/50 text-xs text-foreground',
                            'whitespace-pre-wrap break-words',
                            'max-h-[16rem] overflow-y-auto',
                        )}
                    >
                        {rawContent}
                    </pre>
                )}
            </div>
        </div>
    );
}

// --- Parsers -----------------------------------------------------------
//
// Each prefix gets a pure parser that extracts whatever the compact bubble
// needs. Parsers never throw — on malformed input they return a safe
// fallback so the user still sees SOMETHING sensible instead of a crashed
// render or a silently-dropped message.

interface Parsed {
    icon: string;
    titleKey: string; // translation key; pass to t() with replacements
    titleReplacements?: Record<string, string | number>;
    details?: string;
}

/**
 * truncateSelector keeps long `cssSelector` strings from overflowing the
 * bubble horizontally. `[AI_EDIT]` produces short ones (`<h1.text-5xl>`)
 * but `[BATCH_EDIT]` serializes the full cssSelector which can be much
 * longer (`<h1#hero.text-5xl.font-bold.tracking-tight>`).
 */
export function truncateSelector(s: string, max = 40): string {
    if (s.length <= max) return s;
    return s.slice(0, max - 1) + '…';
}

function parseThemeApply(content: string): Parsed | null {
    // [THEME_APPLY] Applying <name> theme\n\n<rest>
    const match = content.match(/^\[THEME_APPLY\] Applying (.+?) theme/);
    if (!match) return null;
    return {
        icon: '🎨',
        titleKey: 'Applying :name theme',
        titleReplacements: { name: match[1] },
    };
}

function parseDesignApply(content: string): Parsed | null {
    // [DESIGN_APPLY] Applying <name> · <accent>\n\n<rest>
    const match = content.match(/^\[DESIGN_APPLY\] Applying (.+?) · (.+?)(?:\n|$)/);
    if (!match) {
        if (content.startsWith('[DESIGN_APPLY]')) {
            return { icon: '🎨', titleKey: 'Applying design system' };
        }
        return null;
    }
    return {
        icon: '🎨',
        titleKey: 'Applying :name design',
        titleReplacements: { name: match[1].trim() },
        details: match[2].trim(),
    };
}

function parseStyleEdit(content: string): Parsed | null {
    // [STYLE_EDIT] Update element classes:\nElement: <selector>\n[Remove: …]\n[Add: …]\nFinal classes: …
    if (!content.startsWith('[STYLE_EDIT]')) return null;
    const lines = content.split('\n');
    const elementLine = lines.find((l) => l.startsWith('Element:'));
    const removeLine = lines.find((l) => l.startsWith('Remove:'));
    const addLine = lines.find((l) => l.startsWith('Add:'));

    if (!elementLine) {
        return { icon: '✏️', titleKey: 'Style edit' };
    }
    const selector = truncateSelector(elementLine.replace(/^Element:\s*/, '').trim());

    // Build a compact diff summary for the details line.
    let details: string | undefined;
    if (removeLine && addLine) {
        const removed = removeLine.replace(/^Remove:\s*/, '').trim();
        const added = addLine.replace(/^Add:\s*/, '').trim();
        details = `${removed} → ${added}`;
    } else if (addLine) {
        details = '+ ' + addLine.replace(/^Add:\s*/, '').trim();
    } else if (removeLine) {
        details = '− ' + removeLine.replace(/^Remove:\s*/, '').trim();
    }

    return {
        icon: '✏️',
        titleKey: 'Updated styles on :selector',
        titleReplacements: { selector },
        details,
    };
}

function parseAiEdit(content: string): Parsed | null {
    // [AI_EDIT] Improve the styling of <selector>: "<text>"
    const match = content.match(/^\[AI_EDIT\] Improve the styling of (<[^>]+>):\s*"([^"]*)"/);
    if (!match) {
        if (content.startsWith('[AI_EDIT]')) {
            return { icon: '✨', titleKey: 'AI edit' };
        }
        return null;
    }
    const selector = truncateSelector(match[1]);
    const text = match[2];
    return {
        icon: '✨',
        titleKey: 'AI edit on :selector',
        titleReplacements: { selector },
        details: text.length > 60 ? `"${text.slice(0, 60)}…"` : `"${text}"`,
    };
}

function parseBatchEdit(content: string): Parsed | null {
    // [BATCH_EDIT] Update multiple elements:\n1. <selector>: "old" → "new"\n2. …
    if (!content.startsWith('[BATCH_EDIT]')) return null;
    const lines = content.split('\n').slice(1);
    const itemLines = lines.filter((l) => /^\d+\./.test(l.trim()));

    // Malformed payload (no numbered items) — fall back to a generic title
    // rather than inventing a count. `itemLines.length || 1` would have
    // rendered "1 pending change saved" for a payload with ZERO items,
    // which is actively misleading.
    if (itemLines.length === 0) {
        return { icon: '📝', titleKey: 'Batch edit' };
    }

    // First change as the details preview — parse with the same regex the
    // legacy BatchEditMessage used, so we surface the actual text diff.
    let details: string | undefined;
    const m = itemLines[0].match(/^\d+\.\s*<([^>]+)>(?:\s*([^:]+))?:\s*"([^"]*)".*?"([^"]*)"$/);
    if (m) {
        const selector = truncateSelector('<' + m[1] + '>');
        const oldVal = m[3].length > 20 ? m[3].slice(0, 20) + '…' : m[3];
        const newVal = m[4].length > 20 ? m[4].slice(0, 20) + '…' : m[4];
        details = `${selector}: "${oldVal}" → "${newVal}"`;
    } else {
        details = itemLines[0].trim();
    }

    return {
        icon: '📝',
        titleKey: 'Saved :count pending changes',
        titleReplacements: { count: itemLines.length },
        details,
    };
}

/**
 * [UNDO] / [REDO] / [RESTORE] — recorded by the revision endpoints so the AI
 * knows the workspace was reverted. The checkpoint label (when present) is
 * surfaced as the details line.
 */
function parseRevisionEvent(content: string): Parsed | null {
    const kinds: Record<string, { icon: string; titleKey: string }> = {
        '[UNDO]': { icon: '↩️', titleKey: 'Undid the last change' },
        '[REDO]': { icon: '↪️', titleKey: 'Redid a change' },
        '[RESTORE]': { icon: '🕘', titleKey: 'Restored a previous version' },
    };
    const kind = Object.keys(kinds).find((k) => content.startsWith(k));
    if (!kind) return null;

    // Checkpoint labels come from arbitrary user goals and may themselves
    // contain double-quotes (even `".` sequences) — anchor GREEDILY on the
    // fixed sentence suffixes of the recordRevisionEvent templates so the
    // last quote before the suffix delimits the label. Lazy + plain-quote
    // fallbacks cover older/foreign entries.
    const labelMatch =
        content.match(/checkpoint "(.+)"\. Changes made after/s) ??
        content.match(/checkpoint "(.+)"\.$/s) ??
        content.match(/checkpoint "(.+?)"(?:\.|$)/s) ??
        content.match(/checkpoint "([^"]+)"/);
    return {
        ...kinds[kind],
        details: labelMatch ? stripSyntheticPrefix(labelMatch[1]) : undefined,
    };
}

type Parser = (content: string) => Parsed | null;
const parsers: Parser[] = [parseThemeApply, parseDesignApply, parseStyleEdit, parseAiEdit, parseBatchEdit, parseRevisionEvent];

/**
 * Strip synthetic-event marker tokens from a string. Intended for revision
 * history labels where the marker leaks into the human-readable label.
 *
 * Only the four known markers are stripped — a hardcoded allowlist is used
 * instead of a generic regex like `[A-Z_]+` because revision labels are
 * builder-generated from the first ~80 chars of an arbitrary user message,
 * and a user who pastes `[TODO]`, `[GET]`, `[HTTP]`, or any similar bracket
 * token as part of a legitimate instruction would otherwise have that token
 * silently removed. Add the new prefix to SYNTHETIC_PREFIXES below when a
 * fifth synthetic message type is introduced.
 */
const SYNTHETIC_PREFIXES = ['THEME_APPLY', 'DESIGN_APPLY', 'STYLE_EDIT', 'AI_EDIT', 'BATCH_EDIT', 'UNDO', 'REDO', 'RESTORE'] as const;
const SYNTHETIC_PREFIX_REGEX = new RegExp(`\\[(?:${SYNTHETIC_PREFIXES.join('|')})\\]\\s*`, 'g');

export function stripSyntheticPrefix(label: string): string {
    return label.replace(SYNTHETIC_PREFIX_REGEX, '');
}

interface SyntheticEventRendererProps {
    content: string;
}

/**
 * Dispatcher. Returns a rendered SyntheticEventBubble for any recognised
 * synthetic prefix, or null if the content is plain text. Callers fall
 * through to normal message rendering when this returns null.
 */
export function SyntheticEvent({ content }: SyntheticEventRendererProps) {
    const { t } = useTranslation();
    let parsed: Parsed | null = null;
    for (const p of parsers) {
        parsed = p(content);
        if (parsed) break;
    }
    if (!parsed) return null;

    const title = t(parsed.titleKey, parsed.titleReplacements);
    return (
        <SyntheticEventBubble
            icon={parsed.icon}
            title={title}
            details={parsed.details}
            rawContent={content}
        />
    );
}

/**
 * Pure predicate — does this content look like one of our synthetic
 * events? Useful for callers that need to decide BEFORE rendering (e.g.,
 * MessageBubble picking the bubble variant).
 */
export function isSyntheticEvent(content: string): boolean {
    return parsers.some((p) => p(content) !== null);
}
