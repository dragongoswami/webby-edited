import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { FileUploadZone } from '../FileUploadZone';
import type { ProjectFile } from '@/types/storage';

vi.mock('axios', () => ({
    default: {
        post: vi.fn(),
        isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    },
}));

const makeFile = (name: string, type: string, size?: number): File => {
    const file = new File(['content'], name, { type });
    if (size !== undefined) {
        Object.defineProperty(file, 'size', { value: size });
    }
    return file;
};

const selectFile = (container: HTMLElement, file: File) => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
};

const minimalProjectFile = (overrides: Partial<ProjectFile> = {}): ProjectFile => ({
    id: 1,
    project_id: 'p1',
    filename: 'test.png',
    original_filename: 'test.png',
    path: 'test.png',
    mime_type: 'image/png',
    size: 123,
    human_size: '123 B',
    source: 'dashboard',
    is_image: true,
    is_pdf: false,
    is_video: false,
    is_audio: false,
    url: '/files/test.png',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
});

describe('FileUploadZone', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders idle state with size hint and allowed types', () => {
        render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={['image/png', 'image/jpeg']}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        expect(screen.getByText(/Drag & drop files here, or click to select/)).toBeInTheDocument();
        expect(screen.getByText(/Maximum file size: 10 MB/)).toBeInTheDocument();
        expect(screen.getByText(/image\/png, image\/jpeg/)).toBeInTheDocument();
    });

    it('REGRESSION: allowedTypes=["*/*"] allows any file to upload', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: minimalProjectFile(), storage_used: 123 },
        });

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={['*/*']}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('test.png', 'image/png'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                '/project/p1/files',
                expect.any(FormData),
                expect.anything()
            );
        });

        expect(screen.queryByText(/is not allowed/)).not.toBeInTheDocument();
    });

    it('allows a file matching an exact MIME type', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: minimalProjectFile(), storage_used: 123 },
        });

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={['image/png']}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('test.png', 'image/png'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
        });
    });

    it('allows a file matching a prefix wildcard pattern', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: minimalProjectFile(), storage_used: 123 },
        });

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={['image/*']}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('photo.jpg', 'image/jpeg'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
        });
    });

    it('rejects a disallowed file type without calling axios', async () => {
        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={['image/*']}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('doc.pdf', 'application/pdf'));

        await waitFor(() => {
            expect(screen.getByText(/is not allowed/)).toBeInTheDocument();
        });

        expect(axios.post).not.toHaveBeenCalled();
    });

    it('rejects an oversize file without calling axios', async () => {
        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={1}
                allowedTypes={null}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('big.png', 'image/png', 2 * 1024 * 1024));

        await waitFor(() => {
            expect(screen.getByText(/exceeds maximum size of 1 MB/)).toBeInTheDocument();
        });

        expect(axios.post).not.toHaveBeenCalled();
    });

    it('allows any type when allowedTypes is null (only size is checked)', async () => {
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: minimalProjectFile(), storage_used: 123 },
        });

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('archive.zip', 'application/zip'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
        });
    });

    it('runs the successful upload lifecycle: notifies callbacks and shows complete state', async () => {
        const uploadedFile = minimalProjectFile({ id: 42, filename: 'uploaded.png' });
        vi.mocked(axios.post).mockResolvedValue({
            data: { file: uploadedFile, storage_used: 555 },
        });

        const onUploadComplete = vi.fn();
        const onStorageUpdate = vi.fn();

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onUploadComplete={onUploadComplete}
                onStorageUpdate={onStorageUpdate}
            />
        );

        selectFile(container, makeFile('uploaded.png', 'image/png'));

        await waitFor(() => {
            expect(onUploadComplete).toHaveBeenCalledWith(uploadedFile);
        });
        expect(onStorageUpdate).toHaveBeenCalledWith(555);

        await waitFor(() => {
            expect(screen.getByText('uploaded.png')).toBeInTheDocument();
        });
        expect(container.querySelector('.text-success')).toBeInTheDocument();
    });

    it('shows the server error message on a rejected upload and does not call callbacks', async () => {
        vi.mocked(axios.post).mockRejectedValue({
            isAxiosError: true,
            response: { data: { error: 'Quota exceeded' } },
        });

        const onUploadComplete = vi.fn();
        const onStorageUpdate = vi.fn();

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onUploadComplete={onUploadComplete}
                onStorageUpdate={onStorageUpdate}
            />
        );

        selectFile(container, makeFile('test.png', 'image/png'));

        await waitFor(() => {
            expect(screen.getByText('Quota exceeded')).toBeInTheDocument();
        });

        expect(onUploadComplete).not.toHaveBeenCalled();
        expect(onStorageUpdate).not.toHaveBeenCalled();
    });

    it('shows a generic failure message for a non-axios error', async () => {
        vi.mocked(axios.post).mockRejectedValue(new Error('boom'));

        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
            />
        );

        selectFile(container, makeFile('test.png', 'image/png'));

        await waitFor(() => {
            expect(screen.getByText('Upload failed')).toBeInTheDocument();
        });
    });

    it('renders disabled styling when disabled prop is set', () => {
        const { container } = render(
            <FileUploadZone
                projectId="p1"
                maxFileSizeMb={10}
                allowedTypes={null}
                onUploadComplete={vi.fn()}
                onStorageUpdate={vi.fn()}
                disabled
            />
        );

        expect(container.querySelector('.opacity-50.cursor-not-allowed')).toBeInTheDocument();
    });
});
