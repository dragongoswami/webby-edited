import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatUploadButton } from './ChatUploadButton';
import { useChatFileUpload } from '@/hooks/useChatFileUpload';
import type { AttachedFile } from '@/types/chat';

vi.mock('@/hooks/useChatFileUpload', () => ({
    useChatFileUpload: vi.fn(),
}));

const mockedUseChatFileUpload = vi.mocked(useChatFileUpload);

function makeFile(name: string): File {
    return new File(['content'], name, { type: 'text/plain' });
}

function makeAttachedFile(overrides: Partial<AttachedFile> = {}): AttachedFile {
    return {
        id: 1,
        filename: 'file.txt',
        mime_type: 'text/plain',
        size: 100,
        human_size: '100 B',
        is_image: false,
        url: '/file.txt',
        ...overrides,
    };
}

describe('ChatUploadButton', () => {
    let uploadFile: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        uploadFile = vi.fn();
        mockedUseChatFileUpload.mockReturnValue({
            uploadFile,
            isUploading: false,
            uploadProgress: 0,
            uploadError: null,
            clearError: vi.fn(),
        });
    });

    it('has an accessible name matching its title (aria-label)', () => {
        render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: 'Attach file' })).toBeInTheDocument();
    });

    it('renders the paperclip button and a hidden file input with joined accept types', () => {
        const { container } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={['image/*', 'application/pdf']}
                onFileUploaded={vi.fn()}
            />
        );

        const button = screen.getByTitle('Attach file');
        expect(button).toBeInTheDocument();

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('multiple');
        expect(input).toHaveAttribute('accept', 'image/*,application/pdf');
    });

    it('does not set an accept attribute when allowedTypes is null', () => {
        const { container } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={vi.fn()}
            />
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        expect(input).not.toHaveAttribute('accept');
    });

    it('clicking the button clicks the hidden file input', () => {
        const { container } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={vi.fn()}
            />
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

        fireEvent.click(screen.getByTitle('Attach file'));

        expect(clickSpy).toHaveBeenCalled();
        clickSpy.mockRestore();
        void input;
    });

    it('uploads each selected file and calls onFileUploaded in order, then resets the input value', async () => {
        const fileA = makeAttachedFile({ id: 1, filename: 'a.txt' });
        const fileB = makeAttachedFile({ id: 2, filename: 'b.txt' });
        uploadFile.mockResolvedValueOnce(fileA).mockResolvedValueOnce(fileB);

        const onFileUploaded = vi.fn();
        const { container } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={onFileUploaded}
            />
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const files = [makeFile('a.txt'), makeFile('b.txt')];
        Object.defineProperty(input, 'files', { value: files, configurable: true });

        fireEvent.change(input);

        await waitFor(() => expect(onFileUploaded).toHaveBeenCalledTimes(2));

        expect(uploadFile).toHaveBeenCalledTimes(2);
        expect(onFileUploaded.mock.calls[0][0]).toBe(fileA);
        expect(onFileUploaded.mock.calls[1][0]).toBe(fileB);
        expect(input.value).toBe('');
    });

    it('skips onFileUploaded when uploadFile resolves null for a file', async () => {
        const fileB = makeAttachedFile({ id: 2, filename: 'b.txt' });
        uploadFile.mockResolvedValueOnce(null).mockResolvedValueOnce(fileB);

        const onFileUploaded = vi.fn();
        const { container } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={onFileUploaded}
            />
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const files = [makeFile('a.txt'), makeFile('b.txt')];
        Object.defineProperty(input, 'files', { value: files, configurable: true });

        fireEvent.change(input);

        await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(2));

        expect(onFileUploaded).toHaveBeenCalledTimes(1);
        expect(onFileUploaded).toHaveBeenCalledWith(fileB);
    });

    it('does not call uploadFile when the file list is empty', async () => {
        const onFileUploaded = vi.fn();
        const { container } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={onFileUploaded}
            />
        );

        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [], configurable: true });

        await fireEvent.change(input);

        expect(uploadFile).not.toHaveBeenCalled();
        expect(onFileUploaded).not.toHaveBeenCalled();
    });

    it('renders a 40px touch target for the attach button', () => {
        render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={vi.fn()}
            />
        );

        const button = screen.getByTitle('Attach file');
        expect(button.className).toContain('h-10');
        expect(button.className).toContain('w-10');
        expect(button.className).toContain('p-0');
    });

    it('shows a spinner and disables the button while uploading, and honors the disabled prop', () => {
        mockedUseChatFileUpload.mockReturnValue({
            uploadFile,
            isUploading: true,
            uploadProgress: 0,
            uploadError: null,
            clearError: vi.fn(),
        });

        const { container, rerender } = render(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onFileUploaded={vi.fn()}
            />
        );

        const button = screen.getByTitle('Attach file');
        expect(button).toBeDisabled();
        expect(container.querySelector('.animate-spin')).not.toBeNull();
        expect(container.querySelector('svg.lucide-paperclip')).toBeNull();

        mockedUseChatFileUpload.mockReturnValue({
            uploadFile,
            isUploading: false,
            uploadProgress: 0,
            uploadError: null,
            clearError: vi.fn(),
        });

        rerender(
            <ChatUploadButton
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                disabled
                onFileUploaded={vi.fn()}
            />
        );

        expect(screen.getByTitle('Attach file')).toBeDisabled();
    });
});
