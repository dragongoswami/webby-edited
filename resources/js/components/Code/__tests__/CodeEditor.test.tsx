import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { CodeEditor } from '../CodeEditor';

const t = (key: string) => key;

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t }),
}));

let mockResolvedTheme: 'light' | 'dark' = 'light';
vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ resolvedTheme: mockResolvedTheme }),
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        isAxiosError: (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError,
    },
}));

// Controlled textarea stand-in for Monaco's <Editor>, exposing the props we
// care about as data attributes so tests can assert on them without a real
// editor instance. `beforeMount` is never invoked here — that's fine, it
// only configures Monaco-internal TS/JS compiler options.
interface MockEditorProps {
    language?: string;
    theme?: string;
    value?: string;
    onChange?: (value: string) => void;
    options?: { readOnly?: boolean };
}

vi.mock('@monaco-editor/react', () => ({
    default: (props: MockEditorProps) => (
        <textarea
            data-testid="editor"
            data-language={props.language}
            data-readonly={String(props.options?.readOnly)}
            data-theme={props.theme}
            value={props.value}
            onChange={(e) => props.onChange?.(e.target.value)}
            readOnly={props.options?.readOnly}
        />
    ),
}));

// Full 18-entry PROTECTED_FILES list, mirrored from CodeEditor.tsx.
// MUST match the Go backend's executor.ProtectedWriteFiles list
// (webby-builder internal/executor/file.go; verified in sync 2026-07-03, iter 82).
// A drift in the frontend list should fail this test.
const PROTECTED_FILES = [
    'vite.config.ts',
    'tsconfig.json',
    'package.json',
    'package-lock.json',
    'components.json',
    'tailwind.config.ts',
    'tailwind.config.js',
    'postcss.config.js',
    'postcss.config.cjs',
    'index.html',
    'src/main.tsx',
    'src/index.css',
    'src/vite-env.d.ts',
    'tsconfig.node.json',
    'template.json',
    'memory.json',
    'design-intelligence.json',
    'KNOWLEDGE.md',
];

describe('CodeEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolvedTheme = 'light';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders empty state and does not fetch when no file is selected', () => {
        render(<CodeEditor projectId="p1" selectedFile={null} />);

        expect(screen.getByText('No file selected')).toBeInTheDocument();
        expect(screen.getByText('Select a file to edit')).toBeInTheDocument();
        expect(axios.get).not.toHaveBeenCalled();
    });

    it('fetches the file on select, shows skeletons while pending, then renders content', async () => {
        let resolveGet: (value: { data: { content: string } }) => void;
        const pending = new Promise<{ data: { content: string } }>((resolve) => {
            resolveGet = resolve;
        });
        vi.mocked(axios.get).mockReturnValue(pending);

        const { container } = render(
            <CodeEditor projectId="p1" selectedFile="src/App.tsx" />
        );

        expect(axios.get).toHaveBeenCalledWith('/builder/projects/p1/file', {
            params: { path: 'src/App.tsx' },
        });
        expect(screen.getByText('src/App.tsx')).toBeInTheDocument();

        // Skeletons render while the fetch is pending (no editor yet).
        expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
        expect(screen.queryByTestId('editor')).not.toBeInTheDocument();

        resolveGet!({ data: { content: 'const x = 1;' } });

        const editor = await screen.findByTestId('editor');
        expect(editor).toHaveValue('const x = 1;');
    });

    it('shows the axios error field when the fetch fails', async () => {
        vi.mocked(axios.get).mockRejectedValue({
            isAxiosError: true,
            response: { data: { error: 'Nope' } },
        });

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        expect(await screen.findByText('Nope')).toBeInTheDocument();
    });

    it('falls back to a generic message for a non-axios fetch error', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('boom'));

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        expect(await screen.findByText('Failed to load file')).toBeInTheDocument();
    });

    it('renders a protected file as read-only with a badge and no Save button', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: '{}' } });

        render(<CodeEditor projectId="p1" selectedFile="package.json" />);

        expect(await screen.findByText('Read-only')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
        expect(screen.getByTestId('editor')).toHaveAttribute('data-readonly', 'true');
    });

    it('renders every entry in the PROTECTED_FILES contract as read-only', async () => {
        for (const path of PROTECTED_FILES) {
            vi.mocked(axios.get).mockResolvedValue({ data: { content: 'x' } });

            const { unmount } = render(
                <CodeEditor projectId="p1" selectedFile={path} />
            );

            expect(await screen.findByText('Read-only')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
            expect(screen.getByTestId('editor')).toHaveAttribute('data-readonly', 'true');

            unmount();
            vi.clearAllMocks();
        }
    });

    it('renders an editable file with a disabled Save button and no badge', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'const x = 1;' } });

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        await screen.findByTestId('editor');
        expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).toBeDisabled();
        expect(screen.getByTestId('editor')).toHaveAttribute('data-readonly', 'false');
    });

    it('shows the dirty indicator and enables Save after editing', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'const x = 1;' } });

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        const editor = await screen.findByTestId('editor');
        fireEvent.change(editor, { target: { value: 'const x = 2;' } });

        const saveButton = screen.getByRole('button', { name: /Save/i });
        expect(saveButton).not.toBeDisabled();

        const dot = document.querySelector('[title="Unsaved changes"]');
        expect(dot).not.toBeNull();
    });

    it('saves successfully, syncs originalContent, and calls onSave', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'const x = 1;' } });
        vi.mocked(axios.put).mockResolvedValue({ data: {} });
        const onSave = vi.fn();

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" onSave={onSave} />);

        const editor = await screen.findByTestId('editor');
        fireEvent.change(editor, { target: { value: 'const x = 2;' } });

        const saveButton = screen.getByRole('button', { name: /Save/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith('/builder/projects/p1/file', {
                path: 'src/App.tsx',
                content: 'const x = 2;',
            });
        });

        await waitFor(() => expect(saveButton).toBeDisabled());
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[title="Unsaved changes"]')).toBeNull();
    });

    it('shows the axios error field on save failure and stays dirty', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'const x = 1;' } });
        vi.mocked(axios.put).mockRejectedValue({
            isAxiosError: true,
            response: { data: { error: 'Locked' } },
        });

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        const editor = await screen.findByTestId('editor');
        fireEvent.change(editor, { target: { value: 'const x = 2;' } });

        const saveButton = screen.getByRole('button', { name: /Save/i });
        fireEvent.click(saveButton);

        expect(await screen.findByText('Locked')).toBeInTheDocument();
        expect(saveButton).not.toBeDisabled();
    });

    it('saves on Cmd+S / Ctrl+S for an editable dirty file but not for a protected file', async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'const x = 1;' } });
        vi.mocked(axios.put).mockResolvedValue({ data: {} });

        const { rerender } = render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        const editor = await screen.findByTestId('editor');
        fireEvent.change(editor, { target: { value: 'const x = 2;' } });

        fireEvent.keyDown(window, { key: 's', metaKey: true });
        await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));

        vi.mocked(axios.put).mockClear();
        vi.mocked(axios.get).mockClear();
        vi.mocked(axios.get).mockResolvedValue({ data: { content: '{}' } });

        rerender(<CodeEditor projectId="p1" selectedFile="package.json" />);
        await screen.findByText('Read-only');

        fireEvent.keyDown(window, { key: 's', ctrlKey: true });
        // Give any accidental async save a chance to fire.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(axios.put).not.toHaveBeenCalled();
    });

    it.each([
        ['src/App.tsx', 'typescript'],
        ['src/util.ts', 'typescript'],
        ['src/App.jsx', 'javascript'],
        ['src/util.js', 'javascript'],
        ['src/style.css', 'css'],
        ['index.html', 'html'],
        ['data.json', 'json'],
        ['README.md', 'markdown'],
        ['functions.php', 'php'],
        ['feed.xml', 'xml'],
        ['Makefile', 'plaintext'],
    ])('maps %s to the %s Monaco language', async (path, language) => {
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'x' } });

        render(<CodeEditor projectId="p1" selectedFile={path} />);

        const editor = await screen.findByTestId('editor');
        expect(editor).toHaveAttribute('data-language', language);
    });

    it('uses the vs-dark Monaco theme when resolvedTheme is dark', async () => {
        mockResolvedTheme = 'dark';
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'x' } });

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        const editor = await screen.findByTestId('editor');
        expect(editor).toHaveAttribute('data-theme', 'vs-dark');
    });

    it('uses the light Monaco theme when resolvedTheme is light', async () => {
        mockResolvedTheme = 'light';
        vi.mocked(axios.get).mockResolvedValue({ data: { content: 'x' } });

        render(<CodeEditor projectId="p1" selectedFile="src/App.tsx" />);

        const editor = await screen.findByTestId('editor');
        expect(editor).toHaveAttribute('data-theme', 'light');
    });
});
