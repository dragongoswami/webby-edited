import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Radix Dialog needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

const routerPost = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        post: (...args: unknown[]) => routerPost(...args),
    },
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
    toast: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() },
}));

// The global route() helper is stubbed by the test setup to ignore params; replace
// it here with a spy so we can assert on the exact route name used.
const routeSpy = vi.fn((name: string) => `/${name}`);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

import UploadPluginModal from '../UploadPluginModal';

function makeFile(name: string, type = 'application/zip'): File {
    return new File(['dummy content'], name, { type });
}

function getFileInput(): HTMLInputElement {
    return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function getDropZone(): HTMLElement {
    return getFileInput().parentElement as HTMLElement;
}

function getUploadButton(): HTMLElement {
    return screen.getByRole('button', { name: /Install Plugin|Installing/ });
}

describe('UploadPluginModal', () => {
    beforeEach(() => {
        routerPost.mockClear();
        toastSuccess.mockClear();
        routeSpy.mockClear();
    });

    it('renders the dialog with the drop zone and instructions when open', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        expect(screen.getByText('Upload Plugin')).toBeInTheDocument();
        expect(screen.getByText('Upload a plugin ZIP file to install it.')).toBeInTheDocument();
        expect(screen.getByText('Drag and drop a ZIP file here, or click to browse')).toBeInTheDocument();
        expect(screen.getByText('Maximum file size: 10MB')).toBeInTheDocument();
        expect(getUploadButton()).toBeDisabled();
    });

    it('does not render dialog contents when closed', () => {
        render(<UploadPluginModal open={false} onOpenChange={vi.fn()} />);

        expect(screen.queryByText('Upload Plugin')).not.toBeInTheDocument();
    });

    it('selecting a valid .zip file via the hidden input accepts it and enables Upload', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        const file = makeFile('my-plugin.zip');
        fireEvent.change(getFileInput(), { target: { files: [file] } });

        expect(screen.getByText('my-plugin.zip')).toBeInTheDocument();
        expect(screen.queryByText('Only ZIP files are allowed')).not.toBeInTheDocument();
        expect(getUploadButton()).not.toBeDisabled();
    });

    it('selecting a non-zip file shows the validation error and leaves the file unaccepted', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        const file = makeFile('evil.exe', 'application/x-msdownload');
        fireEvent.change(getFileInput(), { target: { files: [file] } });

        expect(screen.getByText('Only ZIP files are allowed')).toBeInTheDocument();
        expect(screen.queryByText('evil.exe')).not.toBeInTheDocument();
        expect(getUploadButton()).toBeDisabled();
    });

    it('dropping a valid .zip file on the drop zone accepts it, same as selecting', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        const file = makeFile('dropped.zip');
        fireEvent.drop(getDropZone(), { dataTransfer: { files: [file] } });

        expect(screen.getByText('dropped.zip')).toBeInTheDocument();
        expect(getUploadButton()).not.toBeDisabled();
    });

    it('dropping a non-zip file shows the validation error', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        const file = makeFile('notes.txt', 'text/plain');
        fireEvent.drop(getDropZone(), { dataTransfer: { files: [file] } });

        expect(screen.getByText('Only ZIP files are allowed')).toBeInTheDocument();
        expect(getUploadButton()).toBeDisabled();
    });

    it('toggles the dragging style on dragover and clears it on dragleave', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        const zone = getDropZone();
        // Not dragging: idle border class present, active-drag class absent.
        expect(zone.className).toContain('border-muted-foreground/25');
        expect(zone.className).not.toContain('bg-primary/5');

        fireEvent.dragOver(zone);
        expect(zone.className).toContain('border-primary bg-primary/5');
        expect(zone.className).not.toContain('border-muted-foreground/25');

        fireEvent.dragLeave(zone);
        expect(zone.className).not.toContain('bg-primary/5');
        expect(zone.className).toContain('border-muted-foreground/25');
    });

    it('clicking Upload with a valid file posts to the upload route with { plugin: file } and shows the uploading spinner state', () => {
        render(<UploadPluginModal open onOpenChange={vi.fn()} />);

        const file = makeFile('my-plugin.zip');
        fireEvent.change(getFileInput(), { target: { files: [file] } });
        fireEvent.click(getUploadButton());

        expect(routeSpy).toHaveBeenCalledWith('admin.plugins.upload');
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data, options] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.plugins.upload');
        expect(data).toEqual({ plugin: file });
        expect(options.forceFormData).toBe(true);
        expect(typeof options.onSuccess).toBe('function');
        expect(typeof options.onError).toBe('function');
        expect(typeof options.onFinish).toBe('function');

        // isUploading is set synchronously before router.post is invoked.
        expect(screen.getByRole('button', { name: 'Installing...' })).toBeDisabled();
    });

    it('invoking onSuccess closes the dialog and resets the selected file', () => {
        const onOpenChange = vi.fn();
        render(<UploadPluginModal open onOpenChange={onOpenChange} />);

        const file = makeFile('my-plugin.zip');
        fireEvent.change(getFileInput(), { target: { files: [file] } });
        fireEvent.click(getUploadButton());

        const options = routerPost.mock.calls[0][2];
        act(() => {
            options.onSuccess();
            options.onFinish();
        });

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(toastSuccess).toHaveBeenCalledWith('Plugin installed successfully');
        expect(screen.queryByText('my-plugin.zip')).not.toBeInTheDocument();
        expect(screen.getByText('Drag and drop a ZIP file here, or click to browse')).toBeInTheDocument();
        // Upload button is disabled again since the file was reset.
        expect(getUploadButton()).toBeDisabled();
    });

    it('invoking onError shows the server error, clears the uploading state, and keeps the dialog open', () => {
        const onOpenChange = vi.fn();
        render(<UploadPluginModal open onOpenChange={onOpenChange} />);

        const file = makeFile('my-plugin.zip');
        fireEvent.change(getFileInput(), { target: { files: [file] } });
        fireEvent.click(getUploadButton());

        const options = routerPost.mock.calls[0][2];
        act(() => {
            options.onError({ plugin: 'The plugin failed validation.' });
            options.onFinish();
        });

        expect(screen.getByText('The plugin failed validation.')).toBeInTheDocument();
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
        expect(screen.getByRole('button', { name: 'Install Plugin' })).not.toBeDisabled();
    });

    it('closing via Cancel resets file/error state and calls onOpenChange(false)', () => {
        const onOpenChange = vi.fn();
        render(<UploadPluginModal open onOpenChange={onOpenChange} />);

        const file = makeFile('my-plugin.zip');
        fireEvent.change(getFileInput(), { target: { files: [file] } });
        expect(screen.getByText('my-plugin.zip')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        // Internal state resets even though the test-controlled `open` prop stays true.
        expect(screen.queryByText('my-plugin.zip')).not.toBeInTheDocument();
        expect(getUploadButton()).toBeDisabled();
    });

    it('closing via the dialog X button also resets state and calls onOpenChange(false)', () => {
        const onOpenChange = vi.fn();
        render(<UploadPluginModal open onOpenChange={onOpenChange} />);

        const file = makeFile('my-plugin.zip');
        fireEvent.change(getFileInput(), { target: { files: [file] } });

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.queryByText('my-plugin.zip')).not.toBeInTheDocument();
    });
});
