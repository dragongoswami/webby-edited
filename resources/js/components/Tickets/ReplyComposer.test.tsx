import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const routerPost = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        post: (...args: unknown[]) => routerPost(...args),
    },
}));

vi.mock('./RichTextEditor', () => ({
    default: ({
        value,
        onChange,
        placeholder,
        ariaLabel,
    }: {
        value: string;
        onChange: (html: string) => void;
        placeholder?: string;
        ariaLabel?: string;
    }) => (
        <textarea
            data-testid="rich-text-editor"
            aria-label={ariaLabel}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

vi.mock('./AttachmentDropzone', () => ({
    default: ({ onChange }: { files: File[]; onChange: (files: File[]) => void }) => (
        <button
            type="button"
            data-testid="attachment-dropzone"
            onClick={() => onChange([new File(['a'], 'a.png'), new File(['b'], 'b.png')])}
        >
            Attach files
        </button>
    ),
}));

import ReplyComposer from './ReplyComposer';

function getEditor(): HTMLTextAreaElement {
    return screen.getByTestId('rich-text-editor') as HTMLTextAreaElement;
}

function getSendButton(): HTMLElement {
    return screen.getByRole('button', { name: /Send reply|Sending…/ });
}

describe('ReplyComposer', () => {
    beforeEach(() => {
        routerPost.mockClear();
    });

    it('renders the disabled notice with default text and no form when disabled', () => {
        render(<ReplyComposer action="/tickets/1/reply" disabled />);

        expect(screen.getByText('Reply to reopen this ticket.')).toBeInTheDocument();
        expect(document.querySelector('form')).not.toBeInTheDocument();
    });

    it('renders a custom disabledMessage when provided', () => {
        render(
            <ReplyComposer
                action="/tickets/1/reply"
                disabled
                disabledMessage="This ticket is closed."
            />,
        );

        expect(screen.getByText('This ticket is closed.')).toBeInTheDocument();
        expect(screen.queryByText('Reply to reopen this ticket.')).not.toBeInTheDocument();
    });

    it('renders the form with the editor, dropzone, and submit button when enabled', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        expect(document.querySelector('form')).toBeInTheDocument();
        expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
        expect(screen.getByTestId('attachment-dropzone')).toBeInTheDocument();
        expect(getSendButton()).toBeInTheDocument();
    });

    it('disables Send and blocks submit when the body is empty', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        expect(getSendButton()).toBeDisabled();

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(routerPost).not.toHaveBeenCalled();
    });

    it('treats markup-only body ("<p></p>") as empty', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p></p>' } });

        expect(getSendButton()).toBeDisabled();

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(routerPost).not.toHaveBeenCalled();
    });

    it('treats a body of only "&nbsp;" as empty', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>&nbsp;</p>' } });

        expect(getSendButton()).toBeDisabled();

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(routerPost).not.toHaveBeenCalled();
    });

    it('enables Send and posts once with a FormData body when the body is non-empty', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>Hello there</p>' } });
        expect(getSendButton()).not.toBeDisabled();

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data, options] = routerPost.mock.calls[0];
        expect(url).toBe('/tickets/1/reply');
        expect(data).toBeInstanceOf(FormData);
        expect((data as FormData).get('body')).toBe('<p>Hello there</p>');
        expect(typeof options).toBe('object');
    });

    it('includes attached files in the FormData under attachments[]', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>Hello there</p>' } });
        fireEvent.click(screen.getByTestId('attachment-dropzone'));

        const form = document.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        const data = routerPost.mock.calls[0][1] as FormData;
        const attachments = data.getAll('attachments[]') as File[];
        expect(attachments).toHaveLength(2);
        expect(attachments.map((f) => f.name)).toEqual(['a.png', 'b.png']);
    });

    it('posts with forceFormData and preserveScroll options set', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>Hello there</p>' } });
        fireEvent.submit(document.querySelector('form') as HTMLFormElement);

        const options = routerPost.mock.calls[0][2];
        expect(options.forceFormData).toBe(true);
        expect(options.preserveScroll).toBe(true);
    });

    it('onSuccess clears the body and attachments', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>Hello there</p>' } });
        fireEvent.submit(document.querySelector('form') as HTMLFormElement);

        const options = routerPost.mock.calls[0][2];
        act(() => {
            options.onSuccess();
        });

        expect(getEditor().value).toBe('');
        expect(getSendButton()).toBeDisabled();
    });

    it('onError shows the joined field errors, falling back to a generic message when empty', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>Hello there</p>' } });
        fireEvent.submit(document.querySelector('form') as HTMLFormElement);

        const options = routerPost.mock.calls[0][2];
        act(() => {
            options.onError({ field1: ['bad'], field2: ['worse'] });
        });

        expect(screen.getByText('bad worse')).toBeInTheDocument();

        routerPost.mockClear();
        fireEvent.submit(document.querySelector('form') as HTMLFormElement);
        const options2 = routerPost.mock.calls[0][2];
        act(() => {
            options2.onError({});
        });

        expect(screen.getByText('Failed to send.')).toBeInTheDocument();
    });

    it('shows "Sending…" while processing and reverts to "Send reply" after onFinish', () => {
        render(<ReplyComposer action="/tickets/1/reply" />);

        fireEvent.change(getEditor(), { target: { value: '<p>Hello there</p>' } });
        fireEvent.submit(document.querySelector('form') as HTMLFormElement);

        expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();

        const options = routerPost.mock.calls[0][2];
        act(() => {
            options.onFinish();
        });

        expect(screen.getByRole('button', { name: 'Send reply' })).not.toBeDisabled();
    });
});
