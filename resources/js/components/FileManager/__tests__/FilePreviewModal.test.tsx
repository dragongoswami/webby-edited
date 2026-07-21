import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilePreviewModal } from '../FilePreviewModal';
import type { ProjectFile } from '@/types/storage';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself) — no re-mock needed here.

// Radix Dialog needs pointer APIs jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

    if (!window.matchMedia) {
        window.matchMedia = (query: string): MediaQueryList => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        });
    }
});

function makeFile(overrides: Partial<ProjectFile> = {}): ProjectFile {
    return {
        id: 1,
        project_id: 'proj-uuid',
        filename: 'stored-name.bin',
        original_filename: 'file.bin',
        path: '/storage/file.bin',
        mime_type: 'application/octet-stream',
        size: 1024,
        human_size: '1 KB',
        source: 'dashboard',
        is_image: false,
        is_pdf: false,
        is_video: false,
        is_audio: false,
        url: '/f/file.bin',
        created_at: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

describe('FilePreviewModal', () => {
    it('renders nothing when file is null', () => {
        const { container } = render(
            <FilePreviewModal file={null} open={true} onClose={vi.fn()} />,
        );

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(container).toBeEmptyDOMElement();
    });

    it('renders an image preview for an image file', () => {
        const file = makeFile({
            is_image: true,
            url: '/f/pic.png',
            original_filename: 'pic.png',
        });

        render(<FilePreviewModal file={file} open={true} onClose={vi.fn()} />);

        const img = screen.getByRole('img') as HTMLImageElement;
        expect(img.src).toContain('/f/pic.png');
        expect(img.alt).toBe('pic.png');
        expect(screen.getByText('pic.png')).toBeInTheDocument();
    });

    it('renders an iframe for a pdf', () => {
        const file = makeFile({
            is_pdf: true,
            url: '/f/doc.pdf',
            original_filename: 'doc.pdf',
        });

        const { baseElement } = render(
            <FilePreviewModal file={file} open={true} onClose={vi.fn()} />,
        );

        const iframe = baseElement.querySelector('iframe');
        expect(iframe).not.toBeNull();
        expect(iframe?.getAttribute('title')).toBe('doc.pdf');
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders a video element for a video file', () => {
        const file = makeFile({
            is_video: true,
            url: '/f/clip.mp4',
            original_filename: 'clip.mp4',
        });

        const { baseElement } = render(
            <FilePreviewModal file={file} open={true} onClose={vi.fn()} />,
        );

        const video = baseElement.querySelector('video');
        expect(video).not.toBeNull();
        expect(video?.getAttribute('src')).toBe('/f/clip.mp4');
    });

    it('renders an audio element for an audio file', () => {
        const file = makeFile({
            is_audio: true,
            url: '/f/song.mp3',
        });

        const { baseElement } = render(
            <FilePreviewModal file={file} open={true} onClose={vi.fn()} />,
        );

        const audio = baseElement.querySelector('audio');
        expect(audio).not.toBeNull();
        expect(audio?.getAttribute('src')).toBe('/f/song.mp3');
        expect(baseElement.querySelector('.lucide-file-headphone')).not.toBeNull();
    });

    it('default branch shows download + File icon for a non-text binary', () => {
        const file = makeFile({
            mime_type: 'application/zip',
            url: '/f/a.zip',
            original_filename: 'a.zip',
            is_image: false,
            is_pdf: false,
            is_video: false,
            is_audio: false,
        });

        const { baseElement } = render(
            <FilePreviewModal file={file} open={true} onClose={vi.fn()} />,
        );

        expect(screen.getByText('Preview not available for this file type')).toBeInTheDocument();

        const link = screen.getByRole('link', { name: /download file/i });
        expect(link).toHaveAttribute('href', '/f/a.zip');
        expect(link).toHaveAttribute('download', 'a.zip');

        expect(baseElement.querySelector('.lucide-file')).not.toBeNull();
        expect(baseElement.querySelector('.lucide-file-text')).toBeNull();
    });

    it('default branch uses the text icon for a text/* mime', () => {
        const file = makeFile({
            mime_type: 'text/plain',
            url: '/f/notes.txt',
            original_filename: 'notes.txt',
            is_image: false,
            is_pdf: false,
            is_video: false,
            is_audio: false,
        });

        const { baseElement } = render(
            <FilePreviewModal file={file} open={true} onClose={vi.fn()} />,
        );

        expect(baseElement.querySelector('.lucide-file-text')).not.toBeNull();
        expect(baseElement.querySelector('.lucide-file')).toBeNull();
        expect(screen.getByText('Preview not available for this file type')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /download file/i })).toBeInTheDocument();
    });

    it('the dialog content is only max-w-4xl from sm and up, not the base viewport (mobile fixes Task 12)', () => {
        const file = makeFile({ is_image: true });

        const { baseElement } = render(
            <FilePreviewModal file={file} open={true} onClose={vi.fn()} />,
        );

        const content = baseElement.querySelector('[role="dialog"]');
        expect(content).not.toBeNull();
        const classes = (content?.className ?? '').split(/\s+/);
        expect(classes).toContain('sm:max-w-4xl');
        expect(classes).not.toContain('max-w-4xl');
    });

    it('header shows the human size and mime type', () => {
        const file = makeFile({
            human_size: '2.5 MB',
            mime_type: 'image/png',
            is_image: true,
        });

        render(<FilePreviewModal file={file} open={true} onClose={vi.fn()} />);

        expect(
            screen.getByText((_, element) => element?.textContent === '2.5 MB • image/png'),
        ).toBeInTheDocument();
    });
});
