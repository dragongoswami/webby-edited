/**
 * Tests for ImageSwapPanel component.
 * Covers current-src display, URL apply, storageEnabled gating,
 * file upload (select + drag/drop), validation, and error/success paths.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { toast } from 'sonner';
import { ImageSwapPanel } from '../ImageSwapPanel';
import type { InspectorElement } from '@/types/inspector';

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s }),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    },
}));

const baseElement: InspectorElement = {
    id: 'el-1',
    tagName: 'img',
    elementId: null,
    classNames: ['hero-image'],
    textPreview: '',
    xpath: '//img',
    cssSelector: 'img.hero-image',
    boundingRect: { top: 0, left: 0, width: 100, height: 100 },
    attributes: { src: 'https://example.com/current.jpg' },
    parentTagName: 'div',
};

const makeFile = (name: string, type: string, size?: number): File => {
    const file = new File(['content'], name, { type });
    if (size !== undefined) {
        Object.defineProperty(file, 'size', { value: size });
    }
    return file;
};

const getFileInput = (container: HTMLElement) =>
    container.querySelector('input[type="file"]') as HTMLInputElement;

const defaultProps = {
    element: baseElement,
    projectId: 'proj-1',
    storageEnabled: true,
    maxFileSizeMb: 5,
    onApply: vi.fn(),
    onClose: vi.fn(),
};

describe('ImageSwapPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the current src as the preview image, a URL input, and a close button', () => {
        render(<ImageSwapPanel {...defaultProps} />);

        const previewImg = document.querySelector('img[alt=""]') as HTMLImageElement;
        expect(previewImg).toBeTruthy();
        expect(previewImg.src).toBe('https://example.com/current.jpg');

        expect(screen.getByPlaceholderText('Enter image URL')).toBeInTheDocument();

        const closeButtons = screen.getAllByRole('button').filter(
            (btn) => btn.querySelector('svg.lucide-x')
        );
        expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('applies a URL: typing a URL and clicking Apply calls onApply(url)', () => {
        const onApply = vi.fn();
        render(<ImageSwapPanel {...defaultProps} onApply={onApply} />);

        const input = screen.getByPlaceholderText('Enter image URL');
        fireEvent.change(input, { target: { value: 'https://example.com/new.png' } });

        const applyButton = screen.getByRole('button', { name: 'Apply' });
        expect(applyButton).not.toBeDisabled();
        fireEvent.click(applyButton);

        expect(onApply).toHaveBeenCalledWith('https://example.com/new.png');
        expect(toast.success).toHaveBeenCalledWith('Image updated');
    });

    it('hides the upload zone when storageEnabled is false, shows it when true', () => {
        const { container, rerender } = render(
            <ImageSwapPanel {...defaultProps} storageEnabled={false} />
        );
        expect(getFileInput(container)).toBeNull();
        expect(screen.queryByText('Drop image here or click to browse')).not.toBeInTheDocument();

        rerender(<ImageSwapPanel {...defaultProps} storageEnabled={true} />);
        expect(getFileInput(container)).toBeTruthy();
        expect(screen.getByText('Drop image here or click to browse')).toBeInTheDocument();
    });

    it('uploads a valid image file within size, then Apply calls onApply with the returned url', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: { url: '/storage/uploaded.png' } },
        });

        const onApply = vi.fn();
        const { container } = render(<ImageSwapPanel {...defaultProps} onApply={onApply} />);

        const file = makeFile('photo.png', 'image/png', 1024);
        fireEvent.change(getFileInput(container), { target: { files: [file] } });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                '/project/proj-1/files',
                expect.any(FormData),
                expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } })
            );
        });

        // Uploaded preview should now show the returned url.
        await waitFor(() => {
            const previewImg = document.querySelector('img[alt=""]') as HTMLImageElement;
            expect(previewImg.src).toContain('/storage/uploaded.png');
        });

        const applyButton = screen.getByRole('button', { name: 'Apply' });
        expect(applyButton).not.toBeDisabled();
        fireEvent.click(applyButton);

        expect(onApply).toHaveBeenCalledWith('/storage/uploaded.png');
    });

    it('falls back to res.data.url when res.data.file.url is absent', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { url: '/storage/fallback.png' },
        });

        const onApply = vi.fn();
        const { container } = render(<ImageSwapPanel {...defaultProps} onApply={onApply} />);

        fireEvent.change(getFileInput(container), {
            target: { files: [makeFile('photo.png', 'image/png', 1024)] },
        });

        await waitFor(() => {
            const previewImg = document.querySelector('img[alt=""]') as HTMLImageElement;
            expect(previewImg.src).toContain('/storage/fallback.png');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        expect(onApply).toHaveBeenCalledWith('/storage/fallback.png');
    });

    it('rejects an invalid MIME type: toast.error("Invalid image format"), no axios call', async () => {
        const { container } = render(<ImageSwapPanel {...defaultProps} />);

        fireEvent.change(getFileInput(container), {
            target: { files: [makeFile('doc.pdf', 'application/pdf')] },
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Invalid image format');
        });
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects an oversize file: toast.error("Failed to upload file"), no axios call', async () => {
        const { container } = render(<ImageSwapPanel {...defaultProps} maxFileSizeMb={1} />);

        const big = makeFile('big.png', 'image/png', 2 * 1024 * 1024);
        fireEvent.change(getFileInput(container), { target: { files: [big] } });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Failed to upload file');
        });
        expect(axios.post).not.toHaveBeenCalled();
    });

    it('shows a spinner while uploading, and an error toast + cleared spinner on failure', async () => {
        let rejectUpload: (err: unknown) => void = () => {};
        vi.mocked(axios.post).mockImplementation(
            () => new Promise((_, reject) => { rejectUpload = reject; })
        );

        const { container } = render(<ImageSwapPanel {...defaultProps} />);

        fireEvent.change(getFileInput(container), {
            target: { files: [makeFile('photo.png', 'image/png', 1024)] },
        });

        await waitFor(() => {
            expect(container.querySelector('svg.lucide-loader-circle')).toBeTruthy();
        });

        rejectUpload(new Error('network error'));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Failed to upload file');
        });
        await waitFor(() => {
            expect(container.querySelector('svg.lucide-loader-circle')).toBeFalsy();
        });
    });

    it('handles a drop of a valid image the same as a file select', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: { url: '/storage/dropped.png' } },
        });

        render(<ImageSwapPanel {...defaultProps} />);
        const dropZone = screen.getByText('Drop image here or click to browse').closest('div')!;

        const file = makeFile('dropped.png', 'image/png', 1024);
        fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                '/project/proj-1/files',
                expect.any(FormData),
                expect.anything()
            );
        });
    });

    it('sets dragOver styling on dragover and clears it on dragleave', () => {
        render(<ImageSwapPanel {...defaultProps} />);
        const dropZone = screen.getByText('Drop image here or click to browse').closest('div')!;

        expect(dropZone.className).not.toContain('border-primary');

        fireEvent.dragOver(dropZone);
        expect(dropZone.className).toContain('border-primary');

        fireEvent.dragLeave(dropZone);
        expect(dropZone.className).not.toContain('border-primary');
    });

    it('calls onClose when the close (X) button is clicked', () => {
        const onClose = vi.fn();
        render(<ImageSwapPanel {...defaultProps} onClose={onClose} />);

        const closeButton = screen.getAllByRole('button').find(
            (btn) => btn.querySelector('svg.lucide-x')
        )!;
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('sizes the icon-only close (X) button at the h-9 w-9 touch-target floor', () => {
        render(<ImageSwapPanel {...defaultProps} />);

        const closeButton = screen.getAllByRole('button').find(
            (btn) => btn.querySelector('svg.lucide-x')
        )!;
        expect(closeButton.className).toContain('h-9');
        expect(closeButton.className).toContain('w-9');
    });

    it('calls onClose when the Cancel button is clicked', () => {
        const onClose = vi.fn();
        render(<ImageSwapPanel {...defaultProps} onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
