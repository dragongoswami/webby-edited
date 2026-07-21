import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileGrid } from '../FileGrid';
import type { ProjectFile } from '@/types/storage';

const makeFile = (overrides: Partial<ProjectFile> = {}): ProjectFile => ({
    id: 1,
    project_id: 'p1',
    filename: 'test.png',
    original_filename: 'test.png',
    path: 'test.png',
    mime_type: 'image/png',
    size: 123,
    human_size: '123 B',
    source: 'dashboard',
    is_image: false,
    is_pdf: false,
    is_video: false,
    is_audio: false,
    url: '/files/test.png',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
});

const noop = {
    onSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onDelete: vi.fn(),
    onPreview: vi.fn(),
};

describe('FileGrid', () => {
    it('renders a card per file with filename and human size', () => {
        const files = [
            makeFile({ id: 1, original_filename: 'alpha.png', human_size: '1 KB' }),
            makeFile({ id: 2, original_filename: 'beta.pdf', human_size: '2 KB', is_pdf: true }),
        ];

        render(
            <FileGrid
                files={files}
                selectedIds={new Set()}
                onSelect={vi.fn()}
                onSelectAll={vi.fn()}
                onDelete={vi.fn()}
                onPreview={vi.fn()}
            />
        );

        expect(screen.getByText('alpha.png')).toBeInTheDocument();
        expect(screen.getByText('1 KB')).toBeInTheDocument();
        expect(screen.getByText('beta.pdf')).toBeInTheDocument();
        expect(screen.getByText('2 KB')).toBeInTheDocument();
    });

    describe('icon mapping', () => {
        it('renders an <img> thumbnail for an image file', () => {
            const files = [makeFile({ id: 1, is_image: true, url: '/files/pic.png' })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            const img = container.querySelector('img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', '/files/pic.png');
            expect(container.querySelector('svg.lucide-image')).not.toBeInTheDocument();
        });

        it('renders FileText icon for a pdf file', () => {
            const files = [makeFile({ id: 1, is_pdf: true })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            expect(container.querySelector('svg.lucide-file-text')).toBeInTheDocument();
        });

        it('renders FileVideo icon for a video file', () => {
            const files = [makeFile({ id: 1, is_video: true })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            expect(container.querySelector('svg.lucide-file-play')).toBeInTheDocument();
        });

        it('renders FileAudio icon for an audio file', () => {
            const files = [makeFile({ id: 1, is_audio: true })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            expect(container.querySelector('svg.lucide-file-headphone')).toBeInTheDocument();
        });

        it('renders the default File icon for an unrecognized type', () => {
            const files = [makeFile({ id: 1 })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            expect(container.querySelector('svg.lucide-file')).toBeInTheDocument();
        });
    });

    describe('select-all checkbox', () => {
        it('is unchecked when no files are selected and calls onSelectAll(true) on click', () => {
            const onSelectAll = vi.fn();
            const files = [makeFile({ id: 1 }), makeFile({ id: 2 })];

            render(
                <FileGrid
                    files={files}
                    selectedIds={new Set()}
                    onSelect={vi.fn()}
                    onSelectAll={onSelectAll}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
            expect(selectAllCheckbox).not.toBeChecked();

            fireEvent.click(selectAllCheckbox);
            expect(onSelectAll).toHaveBeenCalledWith(true);
        });

        it('is checked when all files are selected and calls onSelectAll(false) on click', () => {
            const onSelectAll = vi.fn();
            const files = [makeFile({ id: 1 }), makeFile({ id: 2 })];

            render(
                <FileGrid
                    files={files}
                    selectedIds={new Set([1, 2])}
                    onSelect={vi.fn()}
                    onSelectAll={onSelectAll}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
            expect(selectAllCheckbox).toBeChecked();

            fireEvent.click(selectAllCheckbox);
            expect(onSelectAll).toHaveBeenCalledWith(false);
        });

        it('sets the DOM indeterminate flag when some but not all files are selected', () => {
            const files = [makeFile({ id: 1 }), makeFile({ id: 2 }), makeFile({ id: 3 })];

            render(
                <FileGrid
                    files={files}
                    selectedIds={new Set([1])}
                    onSelect={vi.fn()}
                    onSelectAll={vi.fn()}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            const selectAllCheckbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement & {
                indeterminate: boolean;
            };
            expect(selectAllCheckbox.indeterminate).toBe(true);
            expect(selectAllCheckbox).not.toBeChecked();
        });
    });

    describe('per-card checkbox', () => {
        it('calls onSelect(id, true) when unselected card checkbox is clicked', () => {
            const onSelect = vi.fn();
            const files = [makeFile({ id: 7 })];

            render(
                <FileGrid
                    files={files}
                    selectedIds={new Set()}
                    onSelect={onSelect}
                    onSelectAll={vi.fn()}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            const cardCheckbox = screen.getAllByRole('checkbox')[1];
            fireEvent.click(cardCheckbox);
            expect(onSelect).toHaveBeenCalledWith(7, true);
        });

        it('calls onSelect(id, false) when a selected card checkbox is clicked, and applies the selected ring class', () => {
            const onSelect = vi.fn();
            const files = [makeFile({ id: 7 })];

            const { container } = render(
                <FileGrid
                    files={files}
                    selectedIds={new Set([7])}
                    onSelect={onSelect}
                    onSelectAll={vi.fn()}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            expect(container.querySelector('.ring-2.ring-primary')).toBeInTheDocument();

            const cardCheckbox = screen.getAllByRole('checkbox')[1];
            fireEvent.click(cardCheckbox);
            expect(onSelect).toHaveBeenCalledWith(7, false);
        });
    });

    it('calls onPreview with the file object when the preview button is clicked', () => {
        const onPreview = vi.fn();
        const file = makeFile({ id: 3, original_filename: 'preview-me.png' });

        render(
            <FileGrid
                files={[file]}
                selectedIds={new Set()}
                onSelect={vi.fn()}
                onSelectAll={vi.fn()}
                onDelete={vi.fn()}
                onPreview={onPreview}
            />
        );

        const previewIcon = document.querySelector('svg.lucide-eye');
        const previewButton = previewIcon?.closest('button');
        expect(previewButton).toBeTruthy();
        fireEvent.click(previewButton!);
        expect(onPreview).toHaveBeenCalledWith(file);
    });

    it('calls onDelete with the file id when the delete button is clicked', () => {
        const onDelete = vi.fn();
        const file = makeFile({ id: 9 });

        render(
            <FileGrid
                files={[file]}
                selectedIds={new Set()}
                onSelect={vi.fn()}
                onSelectAll={vi.fn()}
                onDelete={onDelete}
                onPreview={vi.fn()}
            />
        );

        const deleteIcon = document.querySelector('svg.lucide-trash-2');
        const deleteButton = deleteIcon?.closest('button');
        expect(deleteButton).toBeTruthy();
        fireEvent.click(deleteButton!);
        expect(onDelete).toHaveBeenCalledWith(9);
    });

    it('renders the download control as an anchor with href and download attributes', () => {
        const file = makeFile({ id: 5, original_filename: 'report.pdf', url: '/files/report.pdf', is_pdf: true });

        render(
            <FileGrid
                files={[file]}
                selectedIds={new Set()}
                onSelect={vi.fn()}
                onSelectAll={vi.fn()}
                onDelete={vi.fn()}
                onPreview={vi.fn()}
            />
        );

        const downloadIcon = document.querySelector('svg.lucide-download');
        const anchor = downloadIcon?.closest('a');
        expect(anchor).toBeTruthy();
        expect(anchor).toHaveAttribute('href', '/files/report.pdf');
        expect(anchor).toHaveAttribute('download', 'report.pdf');
    });

    it('applies opacity-50 and pointer-events-none to a card whose file id is in the deleting set', () => {
        const files = [makeFile({ id: 1 }), makeFile({ id: 2 })];

        const { container } = render(
            <FileGrid
                files={files}
                selectedIds={new Set()}
                onSelect={vi.fn()}
                onSelectAll={vi.fn()}
                onDelete={vi.fn()}
                onPreview={vi.fn()}
                deleting={new Set([1])}
            />
        );

        expect(container.querySelector('.opacity-50.pointer-events-none')).toBeInTheDocument();
    });

    it('renders nothing when the files array is empty', () => {
        const { container } = render(
            <FileGrid
                files={[]}
                selectedIds={new Set()}
                onSelect={vi.fn()}
                onSelectAll={vi.fn()}
                onDelete={vi.fn()}
                onPreview={vi.fn()}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });

    describe('touch-visible reveal + RTL + hit-slop (mobile fixes Task 12)', () => {
        it('the action overlay is touch-visible per the reveal standard', () => {
            const files = [makeFile({ id: 1 })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            const overlay = container.querySelector('.absolute.end-2');
            expect(overlay).toBeInTheDocument();
            expect(overlay?.className).toContain('opacity-100');
            expect(overlay?.className).toContain('md:opacity-0');
            expect(overlay?.className).toContain('md:group-hover:opacity-100');
            expect(overlay?.className).toContain('group-focus-within:opacity-100');
            // Logical properties, not physical left/right.
            expect(container.querySelector('.absolute.left-2')).not.toBeInTheDocument();
            expect(container.querySelector('.absolute.right-2')).not.toBeInTheDocument();
        });

        it('the checkbox wrapper uses start-2 with a p-2 -m-2 touch hit-slop', () => {
            const files = [makeFile({ id: 1 })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            const wrapper = container.querySelector('.absolute.start-2');
            expect(wrapper).toBeInTheDocument();
            expect(wrapper?.className).toContain('p-2');
            expect(wrapper?.className).toContain('-m-2');
        });

        it('action buttons are at least h-9 w-9', () => {
            const files = [makeFile({ id: 1 })];
            const { container } = render(
                <FileGrid files={files} selectedIds={new Set()} {...noop} />
            );

            const overlay = container.querySelector('.absolute.end-2') as HTMLElement;
            const buttons = overlay.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(0);
            buttons.forEach((btn) => {
                expect(btn.className).toContain('h-9');
                expect(btn.className).toContain('w-9');
            });
        });
    });

    describe('selection count header text', () => {
        it('shows ":count files" text when nothing is selected', () => {
            const files = [makeFile({ id: 1 }), makeFile({ id: 2 })];

            render(
                <FileGrid
                    files={files}
                    selectedIds={new Set()}
                    onSelect={vi.fn()}
                    onSelectAll={vi.fn()}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            expect(screen.getByText('2 files')).toBeInTheDocument();
        });

        it('shows ":count selected" text when files are selected', () => {
            const files = [makeFile({ id: 1 }), makeFile({ id: 2 })];

            render(
                <FileGrid
                    files={files}
                    selectedIds={new Set([1])}
                    onSelect={vi.fn()}
                    onSelectAll={vi.fn()}
                    onDelete={vi.fn()}
                    onPreview={vi.fn()}
                />
            );

            expect(screen.getByText('1 selected')).toBeInTheDocument();
        });
    });
});
