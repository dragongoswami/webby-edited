import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttachmentDropzone from './AttachmentDropzone';

function makeFile(name: string, content = 'content', type = 'image/png'): File {
    return new File([content], name, { type });
}

function withSize(file: File, size: number): File {
    Object.defineProperty(file, 'size', { value: size, configurable: true });
    return file;
}

function getInput(container: HTMLElement): HTMLInputElement {
    return container.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('AttachmentDropzone', () => {
    it('renders the Attach files button with no file list or error when empty', () => {
        const { container } = render(<AttachmentDropzone files={[]} onChange={vi.fn()} />);

        expect(screen.getByText('Attach files')).toBeInTheDocument();
        expect(container.querySelector('ul')).toBeNull();
        expect(container.querySelector('p')).toBeNull();
    });

    it('clicking the Attach files button clicks the hidden file input', () => {
        const { container } = render(<AttachmentDropzone files={[]} onChange={vi.fn()} />);

        const input = getInput(container);
        input.click = vi.fn();

        fireEvent.click(screen.getByText('Attach files'));

        expect(input.click).toHaveBeenCalledTimes(1);
    });

    it('adds a valid selected file via onChange', () => {
        const onChange = vi.fn();
        const { container } = render(<AttachmentDropzone files={[]} onChange={onChange} />);

        const input = getInput(container);
        const file = makeFile('a.png');

        fireEvent.change(input, { target: { files: [file] } });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith([file]);
    });

    it('appends newly selected files to the existing controlled files, preserving order', () => {
        const onChange = vi.fn();
        const fileA = makeFile('a.png');
        const fileB = makeFile('b.png');
        const { container } = render(<AttachmentDropzone files={[fileA]} onChange={onChange} />);

        const input = getInput(container);
        fireEvent.change(input, { target: { files: [fileB] } });

        expect(onChange).toHaveBeenCalledTimes(1);
        const result = onChange.mock.calls[0][0] as File[];
        expect(result).toEqual([fileA, fileB]);
    });

    it('caps the resulting file list at maxFiles (default 5) by slicing', () => {
        const onChange = vi.fn();
        const existing = [makeFile('1.png'), makeFile('2.png'), makeFile('3.png'), makeFile('4.png')];
        const { container } = render(<AttachmentDropzone files={existing} onChange={onChange} />);

        const input = getInput(container);
        fireEvent.change(input, {
            target: { files: [makeFile('5.png'), makeFile('6.png')] },
        });

        expect(onChange).toHaveBeenCalledTimes(1);
        const result = onChange.mock.calls[0][0] as File[];
        expect(result).toHaveLength(5);
    });

    it('caps at maxFiles when already at the cap and one more is added', () => {
        const onChange = vi.fn();
        const existing = [
            makeFile('1.png'),
            makeFile('2.png'),
            makeFile('3.png'),
            makeFile('4.png'),
            makeFile('5.png'),
        ];
        const { container } = render(<AttachmentDropzone files={existing} onChange={onChange} />);

        const input = getInput(container);
        fireEvent.change(input, { target: { files: [makeFile('6.png')] } });

        expect(onChange).toHaveBeenCalledTimes(1);
        const result = onChange.mock.calls[0][0] as File[];
        expect(result).toHaveLength(5);
    });

    it('rejects an oversize file (default maxSizeMb=10), showing an error and not calling onChange', () => {
        const onChange = vi.fn();
        const { container } = render(<AttachmentDropzone files={[]} onChange={onChange} />);

        const big = withSize(makeFile('big.zip'), 11 * 1024 * 1024);
        const input = getInput(container);
        fireEvent.change(input, { target: { files: [big] } });

        const error = container.querySelector('p');
        expect(error).not.toBeNull();
        expect(error?.textContent).toContain('big.zip');
        expect(error?.textContent).toContain('10');
        expect(onChange).not.toHaveBeenCalled();
    });

    it('honors a custom maxSizeMb: exact boundary is accepted, boundary+1 byte is rejected', () => {
        const onChangeOk = vi.fn();
        const { container: containerOk } = render(
            <AttachmentDropzone files={[]} onChange={onChangeOk} maxSizeMb={2} />
        );
        const exact = withSize(makeFile('exact.png'), 2 * 1024 * 1024);
        fireEvent.change(getInput(containerOk), { target: { files: [exact] } });

        expect(onChangeOk).toHaveBeenCalledTimes(1);
        expect(onChangeOk).toHaveBeenCalledWith([exact]);

        const onChangeBad = vi.fn();
        const { container: containerBad } = render(
            <AttachmentDropzone files={[]} onChange={onChangeBad} maxSizeMb={2} />
        );
        const overBoundary = withSize(makeFile('over.png'), 2 * 1024 * 1024 + 1);
        fireEvent.change(getInput(containerBad), { target: { files: [overBoundary] } });

        expect(onChangeBad).not.toHaveBeenCalled();
        expect(containerBad.querySelector('p')?.textContent).toContain('over.png');
    });

    it('clears a previous error once a subsequent valid file is added', () => {
        const onChange = vi.fn();
        const { container } = render(<AttachmentDropzone files={[]} onChange={onChange} />);
        const input = getInput(container);

        const big = withSize(makeFile('big.zip'), 11 * 1024 * 1024);
        fireEvent.change(input, { target: { files: [big] } });
        expect(container.querySelector('p')).not.toBeNull();

        const good = makeFile('good.png');
        fireEvent.change(input, { target: { files: [good] } });

        expect(container.querySelector('p')).toBeNull();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith([good]);
    });

    it('renders each file name in the list when files is non-empty', () => {
        const fileA = makeFile('a.png');
        const fileB = makeFile('b.pdf');
        render(<AttachmentDropzone files={[fileA, fileB]} onChange={vi.fn()} />);

        expect(screen.getByText('a.png')).toBeInTheDocument();
        expect(screen.getByText('b.pdf')).toBeInTheDocument();
    });

    it('removes the file at the clicked index, preserving the others', () => {
        const onChange = vi.fn();
        const fileA = makeFile('a.png');
        const fileB = makeFile('b.png');
        const fileC = makeFile('c.png');
        render(<AttachmentDropzone files={[fileA, fileB, fileC]} onChange={onChange} />);

        const removeButtons = screen.getAllByLabelText('Remove attachment');
        fireEvent.click(removeButtons[1]);

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith([fileA, fileC]);
    });

    it('renders the remove button as a shared ghost icon Button at the h-8 w-8 touch-target floor', () => {
        render(<AttachmentDropzone files={[makeFile('a.png')]} onChange={vi.fn()} />);

        const removeButton = screen.getByLabelText('Remove attachment');
        expect(removeButton.tagName).toBe('BUTTON');
        expect(removeButton.className).toContain('h-8');
        expect(removeButton.className).toContain('w-8');
    });

    it('applies the accept prop and marks the hidden input as multiple + hidden', () => {
        const { container } = render(
            <AttachmentDropzone files={[]} onChange={vi.fn()} accept="image/*,application/pdf" />
        );

        const input = getInput(container);
        expect(input).toHaveAttribute('accept', 'image/*,application/pdf');
        expect(input).toHaveAttribute('multiple');
        expect(input).toHaveClass('hidden');
    });

    it('resets the input value after processing a change so the same file can be re-selected', () => {
        const { container } = render(<AttachmentDropzone files={[]} onChange={vi.fn()} />);
        const input = getInput(container);

        fireEvent.change(input, { target: { files: [makeFile('a.png')] } });

        expect(input.value).toBe('');
    });
});
