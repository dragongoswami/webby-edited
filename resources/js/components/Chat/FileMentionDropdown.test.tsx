import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { FileMentionDropdown } from './FileMentionDropdown';
import type { AttachedFile } from '@/types/chat';

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

function makeFile(overrides: Partial<AttachedFile> = {}): AttachedFile {
    return {
        id: 1,
        filename: 'file.txt',
        mime_type: 'text/plain',
        size: 100,
        human_size: '100 B',
        is_image: false,
        url: '',
        ...overrides,
    };
}

describe('FileMentionDropdown', () => {
    it('shows "No files found" positioned at the given top/left when there are no files', () => {
        render(
            <FileMentionDropdown
                files={[]}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 50, left: 100 }}
            />
        );

        const panel = screen.getByText('No files found');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveStyle({ top: '50px', left: '100px' });
    });

    it('renders filenames and human_size, omitting the size row when missing', () => {
        const files = [
            makeFile({ id: 1, filename: 'a.txt', human_size: '10 KB' }),
            makeFile({ id: 2, filename: 'b.txt', human_size: '' }),
        ];

        render(
            <FileMentionDropdown
                files={files}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        expect(screen.getByText('a.txt')).toBeInTheDocument();
        expect(screen.getByText('10 KB')).toBeInTheDocument();
        expect(screen.getByText('b.txt')).toBeInTheDocument();
        expect(screen.queryByText('0 B')).not.toBeInTheDocument();
    });

    it('highlights the row at selectedIndex with the bg-accent class', () => {
        const files = [makeFile({ id: 1, filename: 'a.txt' }), makeFile({ id: 2, filename: 'b.txt' })];

        render(
            <FileMentionDropdown
                files={files}
                selectedIndex={1}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons[0]).not.toHaveClass('bg-accent');
        expect(buttons[1]).toHaveClass('bg-accent');
    });

    it('calls onSelect with the file and prevents default on mousedown', () => {
        const file = makeFile({ id: 1, filename: 'a.txt' });
        const onSelect = vi.fn();

        render(
            <FileMentionDropdown
                files={[file]}
                selectedIndex={0}
                onSelect={onSelect}
                position={{ top: 0, left: 0 }}
            />
        );

        const button = screen.getByRole('button');
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        const notCancelled = button.dispatchEvent(event);

        expect(onSelect).toHaveBeenCalledWith(file);
        expect(notCancelled).toBe(false);
        expect(event.defaultPrevented).toBe(true);
    });

    it('renders an <img> for an image file with a url, and the Image icon fallback without one', () => {
        const withUrl = makeFile({ id: 1, filename: 'pic.png', is_image: true, url: '/pic.png' });
        const { container, rerender } = render(
            <FileMentionDropdown
                files={[withUrl]}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img).toHaveAttribute('src', '/pic.png');

        const withoutUrl = makeFile({ id: 2, filename: 'pic2.png', is_image: true, url: '' });
        rerender(
            <FileMentionDropdown
                files={[withoutUrl]}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('svg.lucide-image')).not.toBeNull();
    });

    it('renders the FileText icon (no img) for a non-image file', () => {
        const file = makeFile({ id: 1, filename: 'doc.pdf', is_image: false, url: '/doc.pdf' });
        const { container } = render(
            <FileMentionDropdown
                files={[file]}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('svg.lucide-file-text')).not.toBeNull();
    });

    it('shows the Tab kbd hint only on the first row', () => {
        const files = [makeFile({ id: 1, filename: 'a.txt' }), makeFile({ id: 2, filename: 'b.txt' })];

        render(
            <FileMentionDropdown
                files={files}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        const buttons = screen.getAllByRole('button');
        expect(buttons[0].querySelector('kbd')).not.toBeNull();
        expect(buttons[1].querySelector('kbd')).toBeNull();
        expect(screen.getAllByText('Tab')).toHaveLength(1);
    });

    it('scrolls the selected item into view on mount and when selectedIndex changes', () => {
        const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
        scrollSpy.mockClear();

        const files = [makeFile({ id: 1, filename: 'a.txt' }), makeFile({ id: 2, filename: 'b.txt' })];

        const { rerender } = render(
            <FileMentionDropdown
                files={files}
                selectedIndex={0}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        expect(scrollSpy).toHaveBeenCalledTimes(1);

        rerender(
            <FileMentionDropdown
                files={files}
                selectedIndex={1}
                onSelect={vi.fn()}
                position={{ top: 0, left: 0 }}
            />
        );

        expect(scrollSpy).toHaveBeenCalledTimes(2);
    });
});
