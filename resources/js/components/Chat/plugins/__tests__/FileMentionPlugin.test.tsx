import { useEffect } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getRoot,
    $createParagraphNode,
    $createTextNode,
    $isTextNode,
    KEY_DOWN_COMMAND,
    type LexicalEditor,
} from 'lexical';
import { FileMentionNode, $isFileMentionNode } from '../../nodes/FileMentionNode';
import { FileMentionPlugin } from '../FileMentionPlugin';
import type { AttachedFile } from '@/types/chat';

// FileMentionDropdown scrolls the selected row into view; jsdom has no
// layout engine, so stub it exactly like the dropdown's own test does.
// The plugin itself also reads window.getSelection().getRangeAt(0).getBoundingClientRect()
// to position the dropdown — jsdom's Range has no layout engine either, so
// stub that too (a zero rect is fine; these tests assert presence/content,
// not pixel position).
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

function onError(error: Error) {
    throw error;
}

let capturedEditor: LexicalEditor | null = null;

function CaptureEditorPlugin() {
    const [editor] = useLexicalComposerContext();
    useEffect(() => {
        capturedEditor = editor;
    }, [editor]);
    return null;
}

function makeFiles(): AttachedFile[] {
    return [
        { id: 1, filename: 'report.pdf', mime_type: 'application/pdf', is_image: false, size: 100, human_size: '100 B', url: '' },
        { id: 2, filename: 'README.md', mime_type: 'text/markdown', is_image: false, size: 100, human_size: '100 B', url: '' },
        { id: 3, filename: 'logo.png', mime_type: 'image/png', is_image: true, size: 100, human_size: '100 B', url: '' },
        { id: 4, filename: 'invoice.docx', mime_type: 'application/msword', is_image: false, size: 100, human_size: '100 B', url: '' },
        { id: 5, filename: 'presentation.pptx', mime_type: 'application/vnd.ms-powerpoint', is_image: false, size: 100, human_size: '100 B', url: '' },
        { id: 6, filename: 'spreadsheet.xlsx', mime_type: 'application/vnd.ms-excel', is_image: false, size: 100, human_size: '100 B', url: '' },
        { id: 7, filename: 'notes.txt', mime_type: 'text/plain', is_image: false, size: 100, human_size: '100 B', url: '' },
        { id: 8, filename: 'photo.jpg', mime_type: 'image/jpeg', is_image: true, size: 100, human_size: '100 B', url: '' },
    ];
}

function Harness({ files, disabled }: { files: AttachedFile[]; disabled?: boolean }) {
    const initialConfig = {
        namespace: 'FileMentionPluginTest',
        onError,
        nodes: [FileMentionNode],
    };

    return (
        <LexicalComposer initialConfig={initialConfig}>
            <PlainTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
            />
            <CaptureEditorPlugin />
            <FileMentionPlugin files={files} disabled={disabled} />
        </LexicalComposer>
    );
}

/**
 * Replaces the editor's paragraph with `text` and places a collapsed
 * cursor at `cursorOffset` (defaults to the end of the text).
 */
async function setTextAndCursor(text: string, cursorOffset?: number) {
    const editor = capturedEditor!;
    await act(async () => {
        editor.update(
            () => {
                const root = $getRoot();
                root.clear();
                const paragraph = $createParagraphNode();
                const textNode = $createTextNode(text);
                paragraph.append(textNode);
                root.append(paragraph);
                const offset = cursorOffset ?? text.length;
                textNode.select(offset, offset);
            },
            { discrete: true },
        );
    });
}

function dispatchKey(key: string) {
    act(() => {
        capturedEditor!.dispatchCommand(
            KEY_DOWN_COMMAND,
            new KeyboardEvent('keydown', { key, cancelable: true }),
        );
    });
}

/** Reads the current paragraph's children as a simple description array. */
function readParagraphChildren(): Array<{ type: 'mention'; fileId: number; fileName: string } | { type: 'text'; text: string }> {
    const editor = capturedEditor!;
    const result: Array<{ type: 'mention'; fileId: number; fileName: string } | { type: 'text'; text: string }> = [];
    editor.getEditorState().read(() => {
        const root = $getRoot();
        const paragraph = root.getFirstChild();
        if (!paragraph) return;
        for (const child of paragraph.getChildren()) {
            if ($isFileMentionNode(child)) {
                result.push({ type: 'mention', fileId: child.getFileId(), fileName: child.getFileName() });
            } else if ($isTextNode(child)) {
                result.push({ type: 'text', text: child.getTextContent() });
            }
        }
    });
    return result;
}

describe('FileMentionPlugin', () => {
    it('shows no dropdown when there is no @ trigger', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('hello');

        await waitFor(() => {
            expect(screen.queryByText('No files found')).not.toBeInTheDocument();
            expect(screen.queryAllByRole('button')).toHaveLength(0);
        });
    });

    it('opens with the first MAX_RESULTS (6) files for a bare @ at the start', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('@');

        await waitFor(() => {
            expect(screen.getAllByRole('button')).toHaveLength(6);
        });

        for (const name of ['report.pdf', 'README.md', 'logo.png', 'invoice.docx', 'presentation.pptx', 'spreadsheet.xlsx']) {
            expect(screen.getByText(name)).toBeInTheDocument();
        }
        expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
        expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();
    });

    it('filters case-insensitively by the query after an @ preceded by whitespace', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('see @re');

        await waitFor(() => {
            expect(screen.getAllByRole('button')).toHaveLength(4);
        });

        for (const name of ['report.pdf', 'README.md', 'presentation.pptx', 'spreadsheet.xlsx']) {
            expect(screen.getByText(name)).toBeInTheDocument();
        }
        for (const name of ['logo.png', 'invoice.docx', 'notes.txt', 'photo.jpg']) {
            expect(screen.queryByText(name)).not.toBeInTheDocument();
        }
    });

    it('does not open for an @ embedded mid-word', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('email@domain');

        await waitFor(() => {
            expect(screen.queryByText('No files found')).not.toBeInTheDocument();
            expect(screen.queryAllByRole('button')).toHaveLength(0);
        });
    });

    it('shows the "No files found" empty state when nothing matches the query', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('@zzz');

        await waitFor(() => {
            expect(screen.getByText('No files found')).toBeInTheDocument();
        });
        expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('moves the highlighted row with ArrowDown/ArrowUp, clamped at both ends', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('@');

        await waitFor(() => {
            expect(screen.getAllByRole('button')).toHaveLength(6);
        });

        expect(screen.getAllByRole('button')[0]).toHaveClass('bg-accent');

        dispatchKey('ArrowDown');
        await waitFor(() => {
            expect(screen.getAllByRole('button')[1]).toHaveClass('bg-accent');
        });

        // Push past the end (6 results, indices 0-5) — clamps at the last row.
        for (let i = 0; i < 10; i++) {
            dispatchKey('ArrowDown');
        }
        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            expect(buttons[5]).toHaveClass('bg-accent');
            expect(buttons[0]).not.toHaveClass('bg-accent');
        });

        // Push past the start — clamps at 0.
        for (let i = 0; i < 10; i++) {
            dispatchKey('ArrowUp');
        }
        await waitFor(() => {
            const buttons = screen.getAllByRole('button');
            expect(buttons[0]).toHaveClass('bg-accent');
        });
    });

    it('Enter inserts a FileMentionNode for the selected file, replacing the @query text', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('@re');

        await waitFor(() => {
            expect(screen.getAllByRole('button')).toHaveLength(4);
        });

        dispatchKey('Enter');

        await waitFor(() => {
            expect(screen.queryByText('No files found')).not.toBeInTheDocument();
            expect(screen.queryAllByRole('button')).toHaveLength(0);
        });

        const children = readParagraphChildren();
        expect(children).toEqual([
            { type: 'mention', fileId: 1, fileName: 'report.pdf' },
            { type: 'text', text: ' ' },
        ]);
    });

    it('Tab behaves like Enter, inserting the first (only) matching result', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('@lo');

        await waitFor(() => {
            expect(screen.getAllByRole('button')).toHaveLength(1);
        });

        dispatchKey('Tab');

        await waitFor(() => {
            expect(screen.queryAllByRole('button')).toHaveLength(0);
        });

        const children = readParagraphChildren();
        expect(children).toEqual([
            { type: 'mention', fileId: 3, fileName: 'logo.png' },
            { type: 'text', text: ' ' },
        ]);
    });

    it('Escape closes the dropdown without inserting a mention', async () => {
        render(<Harness files={makeFiles()} />);
        await setTextAndCursor('@lo');

        await waitFor(() => {
            expect(screen.getAllByRole('button')).toHaveLength(1);
        });

        dispatchKey('Escape');

        await waitFor(() => {
            expect(screen.queryAllByRole('button')).toHaveLength(0);
            expect(screen.queryByText('No files found')).not.toBeInTheDocument();
        });

        const children = readParagraphChildren();
        expect(children.some((c) => c.type === 'mention')).toBe(false);
        expect(children).toEqual([{ type: 'text', text: '@lo' }]);
    });

    it('never opens a dropdown while disabled', async () => {
        render(<Harness files={makeFiles()} disabled />);
        await setTextAndCursor('@');

        await waitFor(() => {
            expect(screen.queryByText('No files found')).not.toBeInTheDocument();
            expect(screen.queryAllByRole('button')).toHaveLength(0);
        });
    });
});
