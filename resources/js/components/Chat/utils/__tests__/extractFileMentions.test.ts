import { describe, it, expect } from 'vitest';
import { createEditor, $getRoot, $createParagraphNode, $createTextNode, type EditorState } from 'lexical';
import { FileMentionNode, $createFileMentionNode } from '../../nodes/FileMentionNode';
import { extractFileMentions } from '../extractFileMentions';
import type { AttachedFile } from '@/types/chat';

function buildEditorState(populate: () => void): EditorState {
    const editor = createEditor({ nodes: [FileMentionNode], onError: (e) => { throw e; } });
    editor.update(populate, { discrete: true });
    return editor.getEditorState();
}

describe('extractFileMentions', () => {
    it('returns empty result for an empty editor', () => {
        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            $getRoot().append(p);
        });

        const result = extractFileMentions(state);

        expect(result).toEqual({ fileIds: [], attachedFiles: [] });
    });

    it('returns empty result for text-only content with no mentions', () => {
        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            p.append($createTextNode('just some plain text'));
            $getRoot().append(p);
        });

        const result = extractFileMentions(state);

        expect(result).toEqual({ fileIds: [], attachedFiles: [] });
    });

    it('extracts a single mention with fallback metadata when no projectFiles are given', () => {
        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            p.append($createTextNode('see '), $createFileMentionNode(7, 'logo.png', 'image/png', true));
            $getRoot().append(p);
        });

        const result = extractFileMentions(state);

        expect(result.fileIds).toEqual([7]);
        expect(result.attachedFiles).toEqual([
            {
                id: 7,
                filename: 'logo.png',
                mime_type: 'image/png',
                is_image: true,
                size: 0,
                human_size: '',
                url: '',
            },
        ]);
    });

    it('resolves the full projectFiles entry when a match exists', () => {
        const fullFile: AttachedFile = {
            id: 7,
            filename: 'logo.png',
            mime_type: 'image/png',
            is_image: true,
            size: 4096,
            human_size: '4 KB',
            url: 'https://example.test/files/7/logo.png',
        };

        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            p.append($createFileMentionNode(7, 'logo.png', 'image/png', true));
            $getRoot().append(p);
        });

        const result = extractFileMentions(state, [fullFile]);

        expect(result.fileIds).toEqual([7]);
        expect(result.attachedFiles).toEqual([fullFile]);
        expect(result.attachedFiles[0]).toBe(fullFile);
    });

    it('falls back to node metadata when projectFiles has no matching id', () => {
        const otherFile: AttachedFile = {
            id: 99,
            filename: 'other.pdf',
            mime_type: 'application/pdf',
            is_image: false,
            size: 1024,
            human_size: '1 KB',
            url: 'https://example.test/files/99/other.pdf',
        };

        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            p.append($createFileMentionNode(7, 'logo.png', 'image/png', true));
            $getRoot().append(p);
        });

        const result = extractFileMentions(state, [otherFile]);

        expect(result.fileIds).toEqual([7]);
        expect(result.attachedFiles).toEqual([
            {
                id: 7,
                filename: 'logo.png',
                mime_type: 'image/png',
                is_image: true,
                size: 0,
                human_size: '',
                url: '',
            },
        ]);
    });

    it('dedupes multiple mentions of the same fileId in the same paragraph', () => {
        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            p.append(
                $createFileMentionNode(7, 'logo.png', 'image/png', true),
                $createTextNode(' and again '),
                $createFileMentionNode(7, 'logo.png', 'image/png', true),
            );
            $getRoot().append(p);
        });

        const result = extractFileMentions(state);

        expect(result.fileIds).toEqual([7]);
        expect(result.attachedFiles).toHaveLength(1);
    });

    it('collects distinct mentions across multiple paragraphs in document order', () => {
        const state = buildEditorState(() => {
            const root = $getRoot();

            const p1 = $createParagraphNode();
            p1.append($createTextNode('first '), $createFileMentionNode(3, 'a.txt', 'text/plain', false));
            root.append(p1);

            const p2 = $createParagraphNode();
            p2.append($createTextNode('second '), $createFileMentionNode(9, 'b.txt', 'text/plain', false));
            root.append(p2);
        });

        const result = extractFileMentions(state);

        expect(result.fileIds).toEqual([3, 9]);
        expect(result.attachedFiles.map((f) => f.id)).toEqual([3, 9]);
    });

    it('recurses into nested paragraphs to find mentions', () => {
        const state = buildEditorState(() => {
            const root = $getRoot();

            const plainParagraph = $createParagraphNode();
            plainParagraph.append($createTextNode('no mentions here'));
            root.append(plainParagraph);

            const mentionParagraph = $createParagraphNode();
            mentionParagraph.append($createFileMentionNode(5, 'nested.docx', 'application/msword', false));
            root.append(mentionParagraph);
        });

        const result = extractFileMentions(state);

        expect(result.fileIds).toEqual([5]);
        expect(result.attachedFiles).toHaveLength(1);
        expect(result.attachedFiles[0].filename).toBe('nested.docx');
    });

    it('carries through is_image: false and the mime type for non-image mentions', () => {
        const state = buildEditorState(() => {
            const p = $createParagraphNode();
            p.append($createFileMentionNode(11, 'report.csv', 'text/csv', false));
            $getRoot().append(p);
        });

        const result = extractFileMentions(state);

        expect(result.attachedFiles[0]).toEqual({
            id: 11,
            filename: 'report.csv',
            mime_type: 'text/csv',
            is_image: false,
            size: 0,
            human_size: '',
            url: '',
        });
    });
});
