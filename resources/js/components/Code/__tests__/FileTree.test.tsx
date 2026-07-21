import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { FileTree } from '../FileTree';

// `t` must be a stable function reference across renders — FileTree's
// fetchFiles is memoized via useCallback([projectId, t]), so an unstable
// mock would re-create the effect (and re-fetch) on every render.
const t = (key: string) => key;

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t }),
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
    },
}));

interface FileEntry {
    path: string;
    name: string;
    size: number;
    is_dir: boolean;
    mod_time: string;
}

const entry = (overrides: Partial<FileEntry> & Pick<FileEntry, 'path' | 'is_dir'>): FileEntry => ({
    name: overrides.path.split('/').pop() || overrides.path,
    size: 100,
    mod_time: '2024-01-01T00:00:00.000Z',
    ...overrides,
});

const baseFiles: FileEntry[] = [
    entry({ path: 'src', is_dir: true }),
    entry({ path: 'src/App.tsx', is_dir: false }),
    entry({ path: 'src/components', is_dir: true }),
    entry({ path: 'src/components/Button.tsx', is_dir: false }),
    entry({ path: 'index.html', is_dir: false }),
    entry({ path: 'README.md', is_dir: false }),
];

describe('FileTree', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders tree with directories first and alphabetical ordering', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { files: baseFiles } });

        const { container } = render(
            <FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile={null} />
        );

        await screen.findByText('src');

        // src is default-expanded, so its direct children are visible
        expect(screen.getByText('App.tsx')).toBeInTheDocument();
        expect(screen.getByText('components')).toBeInTheDocument();

        // components is collapsed by default, so its child is not rendered
        expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();

        // Dirs-first, then alphabetical ordering at the top level:
        // src -> index.html -> README.md
        const text = container.textContent || '';
        const srcIdx = text.indexOf('src');
        const indexHtmlIdx = text.indexOf('index.html');
        const readmeIdx = text.indexOf('README.md');

        expect(srcIdx).toBeGreaterThanOrEqual(0);
        expect(indexHtmlIdx).toBeGreaterThan(srcIdx);
        expect(readmeIdx).toBeGreaterThan(indexHtmlIdx);
    });

    it('expands a collapsed directory on click and collapses again on second click', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { files: baseFiles } });
        const user = userEvent.setup();

        render(<FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile={null} />);

        await screen.findByText('components');
        expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();

        await user.click(screen.getByText('components'));
        expect(screen.getByText('Button.tsx')).toBeInTheDocument();

        await user.click(screen.getByText('components'));
        expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();
    });

    it('calls onFileSelect with the full path when a file row is clicked', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { files: baseFiles } });
        const user = userEvent.setup();
        const onFileSelect = vi.fn();

        render(<FileTree projectId="p1" onFileSelect={onFileSelect} selectedFile={null} />);

        await screen.findByText('App.tsx');
        await user.click(screen.getByText('App.tsx'));

        expect(onFileSelect).toHaveBeenCalledWith('src/App.tsx');

        onFileSelect.mockClear();
        await user.click(screen.getByText('src'));
        expect(onFileSelect).not.toHaveBeenCalled();
    });

    it('infers implicit parent directories from nested file paths', async () => {
        const files: FileEntry[] = [entry({ path: 'lib/util.ts', is_dir: false })];
        vi.mocked(axios.get).mockResolvedValue({ data: { files } });
        const user = userEvent.setup();

        render(<FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile={null} />);

        await screen.findByText('lib');
        // 'lib' is not part of the default-expanded set, so it starts collapsed
        expect(screen.queryByText('util.ts')).not.toBeInTheDocument();

        await user.click(screen.getByText('lib'));
        expect(screen.getByText('util.ts')).toBeInTheDocument();
    });

    it('renders an error state when the fetch fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(axios.get).mockRejectedValue(new Error('network error'));

        render(<FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile={null} />);

        expect(await screen.findByText('Failed to load files')).toBeInTheDocument();
    });

    it('renders an empty state when there are no files', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { files: [] } });

        render(<FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile={null} />);

        expect(await screen.findByText('No files yet')).toBeInTheDocument();
    });

    it('re-fetches files when the refresh button is clicked', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { files: baseFiles } });
        const user = userEvent.setup();

        render(<FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile={null} />);

        await screen.findByText('src');
        expect(axios.get).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button'));

        await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    it('applies selected styling to the selected file row', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { files: baseFiles } });

        render(
            <FileTree projectId="p1" onFileSelect={vi.fn()} selectedFile="src/App.tsx" />
        );

        const label = await screen.findByText('App.tsx');
        const row = label.closest('div');
        expect(row).not.toBeNull();
        expect(row?.className).toContain('text-primary');
    });
});
