import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { $getRoot, $createParagraphNode, $createTextNode, type LexicalEditor } from 'lexical';
import { ChatInputWithMentions } from './ChatInputWithMentions';
import { $createFileMentionNode } from './nodes/FileMentionNode';
import type { ElementMention } from '@/types/inspector';
import type { AttachedFile } from '@/types/chat';

// ChatUploadButton pulls in useChatFileUpload (axios-backed) — mock the
// component shallowly, mirroring the "simpler" option called out in the task.
vi.mock('./ChatUploadButton', () => ({
    ChatUploadButton: () => null,
}));

// FileMentionPlugin's dropdown scrolls the selected row into view and reads
// the caret's bounding rect to position itself — jsdom has no layout engine,
// so stub both exactly like FileMentionPlugin.test.tsx does (iter-85 lesson).
beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
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
});

function noop() {}

type Props = React.ComponentProps<typeof ChatInputWithMentions>;

function baseProps(overrides: Partial<Props> = {}): Props {
    return {
        value: '',
        onChange: noop,
        onSubmit: noop,
        selectedElement: null,
        onClearElement: noop,
        ...overrides,
    };
}

function renderInput(overrides: Partial<Props> = {}) {
    return render(<ChatInputWithMentions {...baseProps(overrides)} />);
}

/** The Lexical ContentEditable DOM node, with its attached editor instance. */
function getContentEditable(container: HTMLElement): HTMLElement & { __lexicalEditor: LexicalEditor } {
    const el = container.querySelector('[contenteditable="true"]');
    if (!el) throw new Error('contenteditable not found');
    return el as HTMLElement & { __lexicalEditor: LexicalEditor };
}

function makeElement(overrides: Partial<ElementMention> = {}): ElementMention {
    return {
        id: 'el-1',
        tagName: 'DIV',
        selector: 'div.hero-title',
        textPreview: '',
        ...overrides,
    };
}

function makeFile(overrides: Partial<AttachedFile> = {}): AttachedFile {
    return {
        id: 1,
        filename: 'a.txt',
        mime_type: 'text/plain',
        is_image: false,
        size: 100,
        human_size: '100 B',
        url: '',
        ...overrides,
    };
}

describe('ChatInputWithMentions', () => {
    it('renders the default placeholder, or a custom placeholder override', () => {
        const { rerender } = render(<ChatInputWithMentions {...baseProps()} />);
        expect(screen.getByText('Describe what you want to build...')).toBeInTheDocument();

        rerender(<ChatInputWithMentions {...baseProps({ placeholder: 'Ask me anything' })} />);
        expect(screen.getByText('Ask me anything')).toBeInTheDocument();
        expect(screen.queryByText('Describe what you want to build...')).not.toBeInTheDocument();
    });

    it('SyncPlugin pushes external value changes into the editor', async () => {
        const { container, rerender } = renderInput({ value: 'hello' });
        const ce = getContentEditable(container);

        await waitFor(() => expect(ce.textContent).toBe('hello'));

        rerender(<ChatInputWithMentions {...baseProps({ value: 'world' })} />);

        await waitFor(() => expect(ce.textContent).toBe('world'));
        expect(ce.textContent).not.toContain('hello');
    });

    it('SyncPlugin propagates editor content changes back to the parent via onChange', async () => {
        const onChange = vi.fn();
        const { container } = renderInput({ onChange });
        const editor = getContentEditable(container).__lexicalEditor;

        await act(async () => {
            editor.update(() => {
                const root = $getRoot();
                root.clear();
                const p = $createParagraphNode();
                p.append($createTextNode('typed text'));
                root.append(p);
            });
        });

        expect(onChange).toHaveBeenCalledWith('typed text');
    });

    it('does not submit when there is no text, no element, and no files (including whitespace-only text)', async () => {
        const onSubmit = vi.fn();
        const { container, rerender } = renderInput({ value: '', onSubmit });
        await waitFor(() => expect(getContentEditable(container)).toBeTruthy());

        fireEvent.submit(container.querySelector('form')!);
        expect(onSubmit).not.toHaveBeenCalled();

        rerender(<ChatInputWithMentions {...baseProps({ value: '   ', onSubmit })} />);
        await waitFor(() => expect(getContentEditable(container).textContent).toBe('   '));
        fireEvent.submit(container.querySelector('form')!);
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits with trimmed text and an undefined fileData when there are no files', async () => {
        const onSubmit = vi.fn();
        const { container } = renderInput({ value: 'build it', onSubmit });
        await waitFor(() => expect(getContentEditable(container).textContent).toBe('build it'));

        fireEvent.submit(container.querySelector('form')!);

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(onSubmit.mock.calls[0][1]).toBeUndefined();
    });

    it('merges @-mentioned files from the editor with uploaded badge files, deduplicated by id', async () => {
        const onSubmit = vi.fn();
        const uploadedFiles: AttachedFile[] = [
            makeFile({ id: 1, filename: 'a.txt', size: 1, human_size: '1 B' }),
            makeFile({ id: 2, filename: 'b.txt', size: 1, human_size: '1 B' }),
        ];
        const { container } = renderInput({ value: '', onSubmit, uploadedFiles });
        const editor = getContentEditable(container).__lexicalEditor;

        // Insert a mention for file id 1 — also present as an uploaded badge,
        // so the merge must dedupe it (mention metadata wins for shared ids).
        await act(async () => {
            editor.update(
                () => {
                    const root = $getRoot();
                    root.clear();
                    const p = $createParagraphNode();
                    p.append($createFileMentionNode(1, 'a.txt', 'text/plain', false));
                    root.append(p);
                },
                { discrete: true }
            );
        });

        await act(async () => {
            fireEvent.submit(container.querySelector('form')!);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        const fileData = onSubmit.mock.calls[0][1];
        expect(fileData.fileIds).toEqual([1, 2]);
        expect(fileData.attachedFiles).toHaveLength(2);
        expect(fileData.attachedFiles.map((f: AttachedFile) => f.id)).toEqual([1, 2]);
    });

    it('renders the selected element chip and allows removal + submission even when text is empty', () => {
        const onClearElement = vi.fn();
        const onSubmit = vi.fn();
        const element = makeElement({ tagName: 'DIV', selector: 'div.hero-title', textPreview: 'Hello there' });
        const { container } = renderInput({
            value: '',
            selectedElement: element,
            onClearElement,
            onSubmit,
        });

        expect(screen.getByText('DIV.hero-title')).toBeInTheDocument();
        expect(screen.getByText('"Hello there"')).toBeInTheDocument();

        const chip = screen.getByText('DIV.hero-title').closest('div')!;
        const removeButton = within(chip).getByRole('button');
        fireEvent.click(removeButton);
        expect(onClearElement).toHaveBeenCalledTimes(1);

        fireEvent.submit(container.querySelector('form')!);
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('renders uploaded file chips and removes a badge via onRemoveUploadedFile', () => {
        const onRemoveUploadedFile = vi.fn();
        const uploadedFiles = [
            makeFile({ id: 1, filename: 'first.txt' }),
            makeFile({ id: 2, filename: 'second.txt' }),
        ];
        renderInput({ uploadedFiles, onRemoveUploadedFile });

        expect(screen.getByText('first.txt')).toBeInTheDocument();
        expect(screen.getByText('second.txt')).toBeInTheDocument();

        const chip = screen.getByText('first.txt').closest('div')!;
        const removeButton = within(chip).getByRole('button');
        fireEvent.click(removeButton);

        expect(onRemoveUploadedFile).toHaveBeenCalledWith(1);
    });

    it('calls onFilesDropped when storage is enabled, but not when storage is disabled or the input is disabled', () => {
        const file = new File(['content'], 'dropped.txt', { type: 'text/plain' });

        const onFilesDropped = vi.fn();
        const { container, rerender } = renderInput({ storageEnabled: true, onFilesDropped });
        const dropTarget = container.querySelector('form > div')!;

        fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
        expect(onFilesDropped).toHaveBeenCalledTimes(1);
        expect(onFilesDropped.mock.calls[0][0]).toEqual([file]);

        onFilesDropped.mockClear();
        rerender(<ChatInputWithMentions {...baseProps({ storageEnabled: false, onFilesDropped })} />);
        fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
        expect(onFilesDropped).not.toHaveBeenCalled();

        onFilesDropped.mockClear();
        rerender(<ChatInputWithMentions {...baseProps({ storageEnabled: true, disabled: true, onFilesDropped })} />);
        fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
        expect(onFilesDropped).not.toHaveBeenCalled();
    });

    it('Enter submits the form; Shift+Enter does not', async () => {
        const onSubmit = vi.fn();
        const { container } = renderInput({ value: 'hello world', onSubmit });
        const ce = getContentEditable(container);

        await act(async () => {
            fireEvent.keyDown(ce, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
        });
        expect(onSubmit).toHaveBeenCalledTimes(1);

        onSubmit.mockClear();
        await act(async () => {
            fireEvent.keyDown(ce, { key: 'Enter', code: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
        });
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('applies disabled styling to the content editable', () => {
        const { container, rerender } = renderInput({ disabled: false });
        const ce = getContentEditable(container);
        expect(ce.className).not.toContain('opacity-50');
        expect(ce.className).not.toContain('pointer-events-none');

        rerender(<ChatInputWithMentions {...baseProps({ disabled: true })} />);
        const disabledCe = getContentEditable(container);
        expect(disabledCe.className).toContain('opacity-50');
        expect(disabledCe.className).toContain('pointer-events-none');
        expect(disabledCe.className).toContain('cursor-not-allowed');
    });

    it('renders the content editable and its placeholder with iOS-zoom-safe text sizing', () => {
        const { container } = renderInput();
        const ce = getContentEditable(container);
        expect(ce.className).toContain('text-base');
        expect(ce.className).toContain('md:text-sm');

        const placeholder = screen.getByText('Describe what you want to build...');
        expect(placeholder.className).toContain('text-base');
        expect(placeholder.className).toContain('md:text-sm');
    });

    it('gives the element-mention and file-chip remove buttons a padded 44px+ hit area without growing the chip', () => {
        const element = makeElement({ tagName: 'DIV', selector: 'div.hero-title' });
        const uploadedFiles = [makeFile({ id: 1, filename: 'first.txt' })];
        renderInput({ selectedElement: element, uploadedFiles });

        const elementChip = screen.getByText('DIV.hero-title').closest('div')!;
        const elementRemove = within(elementChip).getByRole('button');
        expect(elementRemove.className).toContain('p-2');
        expect(elementRemove.className).toContain('-m-2');

        const fileChip = screen.getByText('first.txt').closest('div')!;
        const fileRemove = within(fileChip).getByRole('button');
        expect(fileRemove.className).toContain('p-2');
        expect(fileRemove.className).toContain('-m-2');
    });

    it('gives the voice input button a 40px reachable touch target', () => {
        vi.stubGlobal('SpeechRecognition', class {
            start = vi.fn();
            stop = vi.fn();
            abort = vi.fn();
        });
        renderInput();

        const micButton = screen.getByRole('button', { name: 'Speak your prompt' });
        expect(micButton.className).toContain('h-10');
        expect(micButton.className).toContain('w-10');
    });
});
