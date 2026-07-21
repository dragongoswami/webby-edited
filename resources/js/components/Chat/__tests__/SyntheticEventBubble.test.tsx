/**
 * Tests for SyntheticEventBubble, the compact-event renderer for the four
 * machine-generated user messages ([THEME_APPLY], [STYLE_EDIT], [AI_EDIT],
 * [BATCH_EDIT]). Exercises:
 *   - each parser produces the expected title / details
 *   - unknown content passes through (isSyntheticEvent returns false,
 *     SyntheticEvent returns null)
 *   - the expand chevron toggles raw content visibility
 *   - malformed payloads render a safe fallback instead of crashing
 *   - truncateSelector and stripSyntheticPrefix helpers
 *
 * The global LanguageContext mock in resources/js/test/setup.ts replaces
 * useTranslation with a pass-through, so assertions can use English
 * templates with :placeholder interpolation intact.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    SyntheticEvent,
    isSyntheticEvent,
    truncateSelector,
    stripSyntheticPrefix,
} from '../SyntheticEventBubble';

describe('isSyntheticEvent', () => {
    it.each([
        ['[THEME_APPLY] Applying Mocha theme\n\nI want to switch...'],
        ['[DESIGN_APPLY] Applying Substrate · emerald\n\nI switched this site...'],
        ['[STYLE_EDIT] Update element classes:\nElement: <h1.text-5xl>\nFinal classes: x'],
        ['[AI_EDIT] Improve the styling of <h1.text-5xl>: "Freshly Baked"'],
        ['[BATCH_EDIT] Update multiple elements:\n1. <h1.text-5xl>: "a" → "b"'],
    ])('returns true for known prefix: %s', (content) => {
        expect(isSyntheticEvent(content)).toBe(true);
    });

    it.each([
        [''],
        ['Hello world'],
        ['Can you add a gallery section?'],
        ['I saw [this] in the spec'],
        ['[lowercase] marker'],
    ])('returns false for plain content: %s', (content) => {
        expect(isSyntheticEvent(content)).toBe(false);
    });
});

describe('SyntheticEvent — THEME_APPLY', () => {
    it('renders a theme-apply bubble with the preset name in the title', () => {
        const content = '[THEME_APPLY] Applying Mocha theme\n\nI want to switch this site to the "Mocha" theme preset...';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Applying Mocha theme')).toBeInTheDocument();
        expect(screen.getByText('🎨')).toBeInTheDocument();
    });

    it('hides raw content by default and reveals it when the chevron is clicked', () => {
        const content = '[THEME_APPLY] Applying Ocean theme\n\nRaw prompt body here.';
        render(<SyntheticEvent content={content} />);
        expect(screen.queryByText(/Raw prompt body here\./)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText(/Raw prompt body here\./)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByText(/Raw prompt body here\./)).not.toBeInTheDocument();
    });
});

describe('SyntheticEvent — DESIGN_APPLY', () => {
    it('renders a compact design-apply bubble instead of the long fixup prompt', () => {
        const content =
            '[DESIGN_APPLY] Applying Substrate · emerald\n\nI switched this site to the "Substrate" design system with the "emerald" accent. Step 1. Scan src/pages/ ... (3 KB of instructions)';
        render(<SyntheticEvent content={content} />);
        // Title shows the system name; accent is the muted details line.
        expect(screen.getByText('Applying Substrate design')).toBeInTheDocument();
        expect(screen.getByText('emerald')).toBeInTheDocument();
        expect(screen.getByText('🎨')).toBeInTheDocument();
        // The long instruction body is NOT dumped into the transcript.
        expect(screen.queryByText(/Step 1\. Scan src\/pages/)).not.toBeInTheDocument();
    });

    it('reveals the raw fixup prompt only when expanded', () => {
        const content = '[DESIGN_APPLY] Applying Substrate · ruby\n\nRaw design fixup body.';
        render(<SyntheticEvent content={content} />);
        expect(screen.queryByText(/Raw design fixup body\./)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText(/Raw design fixup body\./)).toBeInTheDocument();
    });

    it('falls back to a generic title for a malformed marker', () => {
        render(<SyntheticEvent content={'[DESIGN_APPLY] something unexpected'} />);
        expect(screen.getByText('Applying design system')).toBeInTheDocument();
    });
});

describe('SyntheticEvent — STYLE_EDIT', () => {
    it('renders a style-edit bubble with the element selector', () => {
        const content =
            '[STYLE_EDIT] Update element classes:\nElement: <h1.text-5xl>\nRemove: tracking-tight\nAdd: tracking-wide\nFinal classes: text-5xl tracking-wide';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Updated styles on <h1.text-5xl>')).toBeInTheDocument();
        expect(screen.getByText('✏️')).toBeInTheDocument();
    });

    it('shows the class diff as the details line', () => {
        const content =
            '[STYLE_EDIT] Update element classes:\nElement: <h1>\nRemove: tracking-tight\nAdd: tracking-wide\nFinal classes: x';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('tracking-tight → tracking-wide')).toBeInTheDocument();
    });

    it('falls back to "Style edit" when the Element: line is missing', () => {
        const content = '[STYLE_EDIT] Update element classes:\nmalformed payload';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Style edit')).toBeInTheDocument();
    });
});

describe('SyntheticEvent — AI_EDIT', () => {
    it('renders an AI-edit bubble with the selector and the quoted text', () => {
        const content = '[AI_EDIT] Improve the styling of <h1.text-5xl>: "Freshly Baked"';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('AI edit on <h1.text-5xl>')).toBeInTheDocument();
        expect(screen.getByText('"Freshly Baked"')).toBeInTheDocument();
        expect(screen.getByText('✨')).toBeInTheDocument();
    });

    it('truncates the quoted text when it is longer than 60 chars', () => {
        const long = 'x'.repeat(80);
        const content = `[AI_EDIT] Improve the styling of <p>: "${long}"`;
        render(<SyntheticEvent content={content} />);
        const detailNode = screen.getByText((t) => t.startsWith('"xxxxxxxxxx') && t.endsWith('…"'));
        expect(detailNode).toBeInTheDocument();
    });

    it('falls back to "AI edit" when the template is malformed', () => {
        const content = '[AI_EDIT] incomprehensible';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('AI edit')).toBeInTheDocument();
    });
});

describe('SyntheticEvent — BATCH_EDIT', () => {
    it('renders a batch-edit bubble with the change count', () => {
        const content =
            '[BATCH_EDIT] Update multiple elements:\n1. <h1.text-5xl>: "old" → "new"\n2. <p>: "foo" → "bar"\n3. <span>: "a" → "b"';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Saved 3 pending changes')).toBeInTheDocument();
        expect(screen.getByText('📝')).toBeInTheDocument();
    });

    it('shows the first change as the details preview', () => {
        const content =
            '[BATCH_EDIT] Update multiple elements:\n1. <h1.text-5xl>: "Welcome" → "Howdy"\n2. <p>: "a" → "b"';
        render(<SyntheticEvent content={content} />);
        expect(
            screen.getByText('<h1.text-5xl>: "Welcome" → "Howdy"')
        ).toBeInTheDocument();
    });

    it('falls back to "Batch edit" when the payload has no numbered items', () => {
        // A malformed [BATCH_EDIT] with no numbered lines previously
        // rendered "1 pending change saved" (the singular plural of the
        // normal title) — misleading because no count is actually known.
        // Fallback must use the generic title instead.
        const content = '[BATCH_EDIT] Update multiple elements:';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Batch edit')).toBeInTheDocument();
        expect(screen.queryByText(/1 pending change saved/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Saved 1 pending change/)).not.toBeInTheDocument();
    });
});

describe('SyntheticEvent — revision events (UNDO/REDO/RESTORE)', () => {
    it.each([
        ['[UNDO] I reverted the last change. The project files were restored to the checkpoint "Before: Add pricing". Changes made after that checkpoint are no longer in the code.', 'Undid the last change'],
        ['[REDO] I re-applied a previously undone change. The project files now match the checkpoint "Current state".', 'Redid a change'],
        ['[RESTORE] I restored the project files to the checkpoint "Before: Hero redesign". Changes made after that checkpoint are no longer in the code.', 'Restored a previous version'],
    ])('renders a compact bubble: %s', (content, title) => {
        expect(isSyntheticEvent(content)).toBe(true);
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText(title)).toBeInTheDocument();
    });

    it('surfaces the checkpoint label as the details line, stripped of synthetic markers', () => {
        const content = '[UNDO] I reverted the last change. The project files were restored to the checkpoint "Before: [STYLE_EDIT] Update element classes". Changes made after that checkpoint are no longer in the code.';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Before: Update element classes')).toBeInTheDocument();
        expect(screen.queryByText(/\[STYLE_EDIT\]/)).not.toBeInTheDocument();
    });

    it('keeps a label with embedded double-quotes intact', () => {
        // Labels derive from arbitrary user goals — `add a "FAQ" section`
        // must not truncate at the first inner quote.
        const content = '[UNDO] I reverted the last change. The project files were restored to the checkpoint "Before: add a "FAQ" section". Changes made after that checkpoint are no longer in the code.';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Before: add a "FAQ" section')).toBeInTheDocument();
    });

    it('keeps a label containing a quoted word followed by a period intact', () => {
        // The nastiest case: the label itself contains `".` — the greedy
        // suffix-anchored match must not stop at the inner boundary.
        const content = '[UNDO] I reverted the last change. The project files were restored to the checkpoint "Before: fix "title". And also blue". Changes made after that checkpoint are no longer in the code.';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Before: fix "title". And also blue')).toBeInTheDocument();
    });

    it('extracts the label from the REDO end-of-string template', () => {
        const content = '[REDO] I re-applied a previously undone change. The project files now match the checkpoint "Before: tweak "cta". v2".';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Before: tweak "cta". v2')).toBeInTheDocument();
    });

    it('renders without a details line when no checkpoint is quoted', () => {
        const content = '[REDO] I re-applied a previously undone change. The project files now match an earlier checkpoint.';
        render(<SyntheticEvent content={content} />);
        expect(screen.getByText('Redid a change')).toBeInTheDocument();
    });
});

describe('SyntheticEvent — unknown content', () => {
    it('returns null for plain text', () => {
        const { container } = render(<SyntheticEvent content="Hello world" />);
        expect(container.firstChild).toBeNull();
    });
});

describe('SyntheticEvent — RTL logical properties', () => {
    it('uses text-start (not text-left) on the toggle button', () => {
        const content = '[THEME_APPLY] Applying Mocha theme\n\nRest.';
        render(<SyntheticEvent content={content} />);
        const button = screen.getByRole('button');
        expect(button.className).toContain('text-start');
        expect(button.className).not.toContain('text-left');
    });

    it('uses ps-8 (not pl-8) on the collapsed details line', () => {
        const content = '[DESIGN_APPLY] Applying Substrate · emerald\n\nRest.';
        render(<SyntheticEvent content={content} />);
        const details = screen.getByText('emerald');
        expect(details.className).toContain('ps-8');
        expect(details.className).not.toContain('pl-8');
    });

    it('uses ms-8 (not ml-8) on the expanded raw content block', () => {
        const content = '[THEME_APPLY] Applying Ocean theme\n\nRaw prompt body here.';
        render(<SyntheticEvent content={content} />);
        fireEvent.click(screen.getByRole('button'));
        const pre = screen.getByText(/Raw prompt body here\./);
        expect(pre.className).toContain('ms-8');
        expect(pre.className).not.toContain('ml-8');
    });
});

describe('truncateSelector', () => {
    it('leaves short selectors untouched', () => {
        expect(truncateSelector('<h1.text-5xl>')).toBe('<h1.text-5xl>');
    });

    it('truncates long selectors with an ellipsis', () => {
        const long = '<h1#hero.text-5xl.font-bold.tracking-tight.uppercase>';
        const out = truncateSelector(long, 30);
        expect(out.length).toBe(30);
        expect(out.endsWith('…')).toBe(true);
    });

    it('respects the custom max length', () => {
        expect(truncateSelector('abcdef', 4)).toBe('abc…');
    });
});

describe('stripSyntheticPrefix', () => {
    it('strips a [THEME_APPLY] prefix from a revision label', () => {
        expect(stripSyntheticPrefix('Before: [THEME_APPLY] Applying Mocha theme')).toBe(
            'Before: Applying Mocha theme'
        );
    });

    it('strips [BATCH_EDIT] prefix', () => {
        expect(
            stripSyntheticPrefix('Before: [BATCH_EDIT] Update multiple elements: 1. <span>')
        ).toBe('Before: Update multiple elements: 1. <span>');
    });

    it('strips a [DESIGN_APPLY] prefix from a revision label', () => {
        expect(stripSyntheticPrefix('Before: [DESIGN_APPLY] Applying Substrate · emerald')).toBe(
            'Before: Applying Substrate · emerald'
        );
    });

    it('leaves plain labels unchanged', () => {
        expect(stripSyntheticPrefix('Before: I want to switch...')).toBe(
            'Before: I want to switch...'
        );
    });

    it('returns empty string for empty input', () => {
        expect(stripSyntheticPrefix('')).toBe('');
    });

    it('strips multiple known synthetic prefixes defensively', () => {
        expect(stripSyntheticPrefix('[THEME_APPLY] [BATCH_EDIT] hello')).toBe('hello');
    });

    it('strips the revision-event prefixes', () => {
        expect(stripSyntheticPrefix('[UNDO] reverted')).toBe('reverted');
        expect(stripSyntheticPrefix('[REDO] re-applied')).toBe('re-applied');
        expect(stripSyntheticPrefix('[RESTORE] restored')).toBe('restored');
    });

    it('does not strip unknown uppercase bracket tokens', () => {
        // Revision labels are built from the first ~80 chars of the user
        // message, so a user instruction like "add a [TODO] banner" must
        // NOT have [TODO] eaten. Only the four known synthetic prefixes
        // are stripped.
        expect(stripSyntheticPrefix('Before: add a [TODO] banner')).toBe(
            'Before: add a [TODO] banner'
        );
        expect(stripSyntheticPrefix('Before: [GET] /api/users')).toBe(
            'Before: [GET] /api/users'
        );
        expect(stripSyntheticPrefix('Before: [FIXME] please')).toBe(
            'Before: [FIXME] please'
        );
    });

    it('does not eat mixed-case or lowercase bracket content', () => {
        expect(stripSyntheticPrefix('I saw [this] in the spec')).toBe(
            'I saw [this] in the spec'
        );
        expect(stripSyntheticPrefix('[CamelCase] keep')).toBe('[CamelCase] keep');
    });
});
