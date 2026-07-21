import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import RichTextEditor from './RichTextEditor';

// This drives a REAL TipTap/ProseMirror editor in jsdom (probed and confirmed to
// mount cleanly). ProseMirror reads Range geometry when syncing selection, which
// jsdom doesn't implement — stub it exactly like the Lexical precedent
// (ChatInputWithMentions.test.tsx / FileMentionPlugin.test.tsx, iter-85), plus
// getClientRects which ProseMirror's view also probes.
beforeAll(() => {
    Range.prototype.getBoundingClientRect = vi.fn(() => ({
        bottom: 0,
        left: 0,
        top: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
    }));
    Range.prototype.getClientRects = vi.fn(
        () =>
            ({
                length: 0,
                item: () => null,
                [Symbol.iterator]: function* () {},
            }) as unknown as DOMRectList,
    );
});

afterEach(cleanup);

type TiptapDom = HTMLElement & { editor: import('@tiptap/react').Editor };

/** The ProseMirror contenteditable DOM node, with the TipTap Editor instance
 * attached to it (ProseMirror's view stashes it there, mirroring how the
 * Lexical tests grab `__lexicalEditor` off their contenteditable node). */
function getContentEditable(container: HTMLElement): TiptapDom {
    const el = container.querySelector('[contenteditable="true"]');
    if (!el) throw new Error('contenteditable not found');
    return el as TiptapDom;
}

async function selectAll(container: HTMLElement) {
    const editor = getContentEditable(container).editor;
    await act(async () => {
        editor.commands.selectAll();
    });
}

describe('RichTextEditor', () => {
    it('renders the toolbar with a button for every formatting action, plus the placeholder', async () => {
        const onChange = vi.fn();
        const { container } = render(
            <RichTextEditor value="" onChange={onChange} placeholder="Type your reply..." />,
        );

        await waitFor(() => expect(getContentEditable(container)).toBeTruthy());

        for (const label of [
            'Bold',
            'Italic',
            'Strikethrough',
            'Heading',
            'Bullet list',
            'Numbered list',
            'Quote',
            'Code block',
            'Link',
        ]) {
            const button = screen.getByLabelText(label);
            expect(button).toBeInTheDocument();
            // 36px (h-9 w-9) minimum touch target for the dense toolbar row.
            expect(button.className).toContain('h-9');
            expect(button.className).toContain('w-9');
        }

        const p = getContentEditable(container).querySelector('p');
        expect(p).toHaveAttribute('data-placeholder', 'Type your reply...');
    });

    it('renders the given HTML value inside the editor on mount', async () => {
        const onChange = vi.fn();
        const { container } = render(
            <RichTextEditor value="<p>hello <strong>world</strong></p>" onChange={onChange} />,
        );

        await waitFor(() => expect(getContentEditable(container).innerHTML).toContain('<strong>world</strong>'));
        expect(getContentEditable(container).textContent).toBe('hello world');
    });

    it('re-syncs the editor content when the external value prop changes', async () => {
        const onChange = vi.fn();
        const { container, rerender } = render(<RichTextEditor value="<p>first</p>" onChange={onChange} />);
        const ce = getContentEditable(container);
        await waitFor(() => expect(ce.textContent).toBe('first'));

        rerender(<RichTextEditor value="<p>second</p>" onChange={onChange} />);
        await waitFor(() => expect(ce.textContent).toBe('second'));
        expect(ce.textContent).not.toContain('first');
    });

    it('does not clobber in-progress edits: a same-HTML value re-render is a no-op', async () => {
        const onChange = vi.fn();
        const { container, rerender } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);
        const ce = getContentEditable(container);
        await waitFor(() => expect(ce.textContent).toBe('hello'));

        // Toggle bold without going through the `value` prop (simulates the user
        // typing/formatting) — a re-render with the *same* stale `value` must not
        // stomp the live edit, since the effect only calls setContent when the
        // current editor HTML differs from `value`.
        await selectAll(container);
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Bold'));
        });
        expect(ce.innerHTML).toBe('<p><strong>hello</strong></p>');

        rerender(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);
        expect(ce.innerHTML).toBe('<p><strong>hello</strong></p>');
    });

    it('maps the empty-paragraph HTML to an empty string in onChange', async () => {
        const onChange = vi.fn();
        const { container } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);
        const editor = getContentEditable(container).editor;

        await selectAll(container);
        await act(async () => {
            editor.commands.deleteSelection();
        });

        expect(onChange).toHaveBeenLastCalledWith('');
    });

    it('emits non-empty HTML from onChange for a normal edit', async () => {
        const onChange = vi.fn();
        const { container } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

        await selectAll(container);
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Bold'));
        });

        expect(onChange).toHaveBeenLastCalledWith('<p><strong>hello</strong></p>');
    });

    it.each([
        ['Bold', '<strong>hello</strong>'],
        ['Italic', '<em>hello</em>'],
        ['Strikethrough', '<s>hello</s>'],
        ['Heading', '<h2>hello</h2>'],
        ['Bullet list', '<ul><li><p>hello</p></li></ul>'],
        ['Numbered list', '<ol><li><p>hello</p></li></ol>'],
        ['Quote', '<blockquote><p>hello</p></blockquote>'],
        ['Code block', '<pre><code>hello</code></pre>'],
    ])('the %s toolbar button toggles the matching mark/node on the selection', async (label, expectedHtml) => {
        const onChange = vi.fn();
        const { container } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

        await selectAll(container);
        await act(async () => {
            fireEvent.click(screen.getByLabelText(label));
        });

        expect(getContentEditable(container).innerHTML).toContain(expectedHtml);
    });

    it('reflects the active formatting state in the toolbar button styling once the parent re-renders', async () => {
        const onChange = vi.fn();
        const { container, rerender } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

        await selectAll(container);
        await act(async () => {
            fireEvent.click(screen.getByLabelText('Bold'));
        });
        // The active-state class is computed inline from `editor.isActive(...)`
        // during render; TipTap's default useEditor does not force a re-render
        // on every transaction, so (as in the real controlled-parent usage) a
        // fresh render pass is needed to observe it.
        rerender(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

        expect(screen.getByLabelText('Bold').className).toContain('bg-muted');
        expect(screen.getByLabelText('Italic').className).not.toContain('bg-muted');
    });

    it('clicking every toolbar button with a collapsed (empty) selection does not throw and leaves the editor usable', async () => {
        const onChange = vi.fn();
        const { container } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

        for (const label of [
            'Bold',
            'Italic',
            'Strikethrough',
            'Heading',
            'Bullet list',
            'Numbered list',
            'Quote',
            'Code block',
        ]) {
            await act(async () => {
                fireEvent.click(screen.getByLabelText(label));
            });
        }

        expect(getContentEditable(container).editor.isDestroyed).toBe(false);
    });

    describe('link dialog', () => {
        it('opens with a default https:// URL when the selection has no existing link', async () => {
            const onChange = vi.fn();
            render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

            await act(async () => {
                fireEvent.click(screen.getByLabelText('Link'));
            });

            expect(await screen.findByText('Insert link')).toBeInTheDocument();
            expect(screen.getByLabelText('URL')).toHaveValue('https://');
            expect(screen.getByText('Remove link')).toBeDisabled();
        });

        it('pre-fills the existing href and enables Remove link when the cursor is inside a link', async () => {
            const onChange = vi.fn();
            const { container } = render(
                <RichTextEditor
                    value='<p><a href="https://existing.example.com">hello</a> world</p>'
                    onChange={onChange}
                />,
            );
            const editor = getContentEditable(container).editor;
            await act(async () => {
                editor.commands.setTextSelection(2);
            });

            await act(async () => {
                fireEvent.click(screen.getByLabelText('Link'));
            });

            expect(await screen.findByText('Insert link')).toBeInTheDocument();
            expect(screen.getByLabelText('URL')).toHaveValue('https://existing.example.com');
            expect(screen.getByText('Remove link')).not.toBeDisabled();
        });

        it('Apply sets the link mark (with rel/target hardening) on the selection and closes the dialog', async () => {
            const onChange = vi.fn();
            const { container } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);

            await selectAll(container);
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Link'));
            });
            await screen.findByText('Insert link');

            fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Apply'));
            });

            expect(screen.queryByText('Insert link')).not.toBeInTheDocument();
            const ce = getContentEditable(container);
            expect(ce.innerHTML).toContain('href="https://example.com"');
            expect(ce.innerHTML).toContain('rel="noopener noreferrer nofollow"');
            expect(ce.innerHTML).toContain('target="_blank"');
        });

        it('Apply with a blank/unchanged https:// URL unsets an existing link instead of setting one', async () => {
            const onChange = vi.fn();
            const { container } = render(
                <RichTextEditor value='<p><a href="https://existing.example.com">hello</a></p>' onChange={onChange} />,
            );

            await selectAll(container);
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Link'));
            });
            await screen.findByText('Insert link');

            fireEvent.change(screen.getByLabelText('URL'), { target: { value: '   ' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Apply'));
            });

            expect(screen.queryByText('Insert link')).not.toBeInTheDocument();
            expect(getContentEditable(container).innerHTML).not.toContain('<a ');
        });

        it('Cancel closes the dialog without modifying the content', async () => {
            const onChange = vi.fn();
            const { container } = render(<RichTextEditor value="<p>hello</p>" onChange={onChange} />);
            const before = getContentEditable(container).innerHTML;

            await selectAll(container);
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Link'));
            });
            await screen.findByText('Insert link');

            fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } });
            await act(async () => {
                fireEvent.click(screen.getByText('Cancel'));
            });

            expect(screen.queryByText('Insert link')).not.toBeInTheDocument();
            expect(getContentEditable(container).innerHTML).toBe(before);
        });

        it('Remove link unsets the link and closes the dialog', async () => {
            const onChange = vi.fn();
            const { container } = render(
                <RichTextEditor value='<p><a href="https://existing.example.com">hello</a></p>' onChange={onChange} />,
            );
            const editor = getContentEditable(container).editor;
            await act(async () => {
                editor.commands.setTextSelection(2);
            });

            await act(async () => {
                fireEvent.click(screen.getByLabelText('Link'));
            });
            await screen.findByText('Insert link');

            await act(async () => {
                fireEvent.click(screen.getByText('Remove link'));
            });

            expect(screen.queryByText('Insert link')).not.toBeInTheDocument();
            expect(getContentEditable(container).innerHTML).not.toContain('<a ');
        });
    });

    it('applies the invalid styling to the editor wrapper when `invalid` is true, and omits it otherwise', async () => {
        const onChange = vi.fn();
        const { container, rerender } = render(<RichTextEditor value="<p>a</p>" onChange={onChange} invalid />);
        await waitFor(() => expect(getContentEditable(container)).toBeTruthy());

        const wrapper = within(container).getByText('a').closest('.rounded-md.border')!;
        expect(wrapper.className).toContain('border-destructive');

        rerender(<RichTextEditor value="<p>a</p>" onChange={onChange} invalid={false} />);
        const wrapperAfter = within(container).getByText('a').closest('.rounded-md.border')!;
        expect(wrapperAfter.className).not.toContain('border-destructive');
    });

    it('applies the minHeight prop as an inline style on the editable area, defaulting to 140', async () => {
        const onChange = vi.fn();
        const { container } = render(<RichTextEditor value="<p>a</p>" onChange={onChange} />);
        await waitFor(() => expect(getContentEditable(container)).toBeTruthy());
        expect(getContentEditable(container).getAttribute('style')).toContain('min-height: 140px');

        cleanup();
        const { container: container2 } = render(
            <RichTextEditor value="<p>a</p>" onChange={onChange} minHeight={300} />,
        );
        await waitFor(() => expect(getContentEditable(container2)).toBeTruthy());
        expect(getContentEditable(container2).getAttribute('style')).toContain('min-height: 300px');
    });

    it('forwards the ariaLabel prop onto the editable area', async () => {
        const onChange = vi.fn();
        const { container } = render(
            <RichTextEditor value="<p>a</p>" onChange={onChange} ariaLabel="Reply body" />,
        );
        await waitFor(() => expect(getContentEditable(container)).toBeTruthy());
        expect(getContentEditable(container)).toHaveAttribute('aria-label', 'Reply body');
    });

    it('omits the aria-label attribute entirely when no ariaLabel prop is given', async () => {
        const onChange = vi.fn();
        const { container } = render(<RichTextEditor value="<p>a</p>" onChange={onChange} />);
        await waitFor(() => expect(getContentEditable(container)).toBeTruthy());
        expect(getContentEditable(container)).not.toHaveAttribute('aria-label');
    });
});
