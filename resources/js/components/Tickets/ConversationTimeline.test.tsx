import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConversationTimeline, { type TicketTimelineMessage } from './ConversationTimeline';

const formatDateTime = vi.fn((s: string) => 'FMT:' + s);

vi.mock('@/lib/date', () => ({
    useAppDate: () => ({
        formatDateTime,
    }),
}));

function makeMessage(overrides: Partial<TicketTimelineMessage> = {}): TicketTimelineMessage {
    return {
        id: 1,
        body: '<p>hello</p>',
        created_at: '2026-01-01T10:00:00Z',
        user: { id: 1, name: 'Alice', role: 'user', avatar: null },
        attachments: [],
        ...overrides,
    };
}

describe('ConversationTimeline', () => {
    it('renders empty state when no messages', () => {
        const { container } = render(<ConversationTimeline messages={[]} attachmentBaseUrl="/attachments" />);

        expect(screen.getByText('No messages yet.')).toBeInTheDocument();
        expect(container.querySelector('ol')).not.toBeInTheDocument();
        expect(container.querySelector('li')).not.toBeInTheDocument();
    });

    it('renders a user message without the Support badge and with bg-card styling', () => {
        const { container } = render(
            <ConversationTimeline messages={[makeMessage()]} attachmentBaseUrl="/attachments" />,
        );

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.queryByText('Support')).not.toBeInTheDocument();

        const li = container.querySelector('li');
        expect(li).not.toBeNull();
        expect(li).toHaveClass('bg-card');
        expect(li).not.toHaveClass('bg-muted');
    });

    it('renders an admin message with the Support badge and bg-muted styling', () => {
        const message = makeMessage({
            user: { id: 2, name: 'Bob', role: 'admin', avatar: null },
        });
        const { container } = render(
            <ConversationTimeline messages={[message]} attachmentBaseUrl="/attachments" />,
        );

        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Support')).toBeInTheDocument();

        const li = container.querySelector('li');
        expect(li).toHaveClass('bg-muted');
        expect(li).not.toHaveClass('bg-card');
    });

    it('falls back to "Deleted user" and treats a null user as non-admin', () => {
        const message = makeMessage({ user: null });
        const { container } = render(
            <ConversationTimeline messages={[message]} attachmentBaseUrl="/attachments" />,
        );

        expect(screen.getByText('Deleted user')).toBeInTheDocument();
        expect(screen.queryByText('Support')).not.toBeInTheDocument();

        const li = container.querySelector('li');
        expect(li).toHaveClass('bg-card');
        expect(li).not.toHaveClass('bg-muted');
    });

    it('renders message body as raw HTML via dangerouslySetInnerHTML', () => {
        const message = makeMessage({ body: '<strong>bold</strong> text' });
        const { container } = render(
            <ConversationTimeline messages={[message]} attachmentBaseUrl="/attachments" />,
        );

        const strong = container.querySelector('strong');
        expect(strong).not.toBeNull();
        expect(strong).toHaveTextContent('bold');
    });

    it('renders attachment links with correct href and name, and shows the paperclip icon', () => {
        const message = makeMessage({
            attachments: [
                { id: 10, original_name: 'file-one.pdf', size_bytes: 100 },
                { id: 11, original_name: 'file-two.png', size_bytes: 200 },
            ],
        });
        const { container } = render(
            <ConversationTimeline messages={[message]} attachmentBaseUrl="/attachments" />,
        );

        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(2);

        expect(links[0]).toHaveAttribute('href', '/attachments/10');
        expect(links[0]).toHaveTextContent('file-one.pdf');
        expect(links[0].querySelector('svg')).not.toBeNull();

        expect(links[1]).toHaveAttribute('href', '/attachments/11');
        expect(links[1]).toHaveTextContent('file-two.png');

        // Sanity: no stray attachment container issues
        expect(container.querySelectorAll('li li')).toHaveLength(2);
    });

    it('renders no attachment list when there are no attachments', () => {
        const { container } = render(
            <ConversationTimeline messages={[makeMessage({ attachments: [] })]} attachmentBaseUrl="/attachments" />,
        );

        expect(container.querySelectorAll('a')).toHaveLength(0);
        expect(container.querySelectorAll('li li')).toHaveLength(0);
    });

    it('wires formatDateTime into the <time> element with proper attributes', () => {
        const message = makeMessage({ created_at: '2026-02-14T08:30:00Z' });
        const { container } = render(
            <ConversationTimeline messages={[message]} attachmentBaseUrl="/attachments" />,
        );

        const time = container.querySelector('time');
        expect(time).not.toBeNull();
        expect(time).toHaveTextContent('FMT:2026-02-14T08:30:00Z');
        expect(time).toHaveAttribute('dateTime', '2026-02-14T08:30:00Z');
        expect(time).toHaveAttribute('title', '2026-02-14T08:30:00Z');
        expect(formatDateTime).toHaveBeenCalledWith('2026-02-14T08:30:00Z');
    });

    it('renders multiple messages in order, one <li> per message', () => {
        const messages = [
            makeMessage({ id: 1, user: { id: 1, name: 'First', role: 'user', avatar: null }, body: '<p>one</p>' }),
            makeMessage({ id: 2, user: { id: 2, name: 'Second', role: 'user', avatar: null }, body: '<p>two</p>' }),
            makeMessage({ id: 3, user: { id: 3, name: 'Third', role: 'user', avatar: null }, body: '<p>three</p>' }),
        ];
        const { container } = render(
            <ConversationTimeline messages={messages} attachmentBaseUrl="/attachments" />,
        );

        const items = screen.getAllByRole('listitem');
        // one top-level <li> per message (no attachments so no nested <li>)
        expect(items).toHaveLength(3);

        const names = Array.from(container.querySelectorAll('li > header > span.font-medium')).map(
            (el) => el.textContent,
        );
        expect(names).toEqual(['First', 'Second', 'Third']);
    });

    it('renders a mix of admin and user messages with correct badges/styling for each', () => {
        const messages = [
            makeMessage({ id: 1, user: { id: 1, name: 'Customer', role: 'user', avatar: null } }),
            makeMessage({ id: 2, user: { id: 2, name: 'Agent', role: 'admin', avatar: null } }),
        ];
        const { container } = render(
            <ConversationTimeline messages={messages} attachmentBaseUrl="/attachments" />,
        );

        const lis = container.querySelectorAll('ol > li');
        expect(lis).toHaveLength(2);

        expect(lis[0]).toHaveClass('bg-card');
        expect(lis[0]).not.toHaveClass('bg-muted');

        expect(lis[1]).toHaveClass('bg-muted');
        expect(lis[1]).not.toHaveClass('bg-card');

        // Only one "Support" badge should be present (for the admin message).
        expect(screen.getAllByText('Support')).toHaveLength(1);
    });

    it('constructs attachment href by exact concatenation of base + / + id', () => {
        const message = makeMessage({
            attachments: [{ id: 42, original_name: 'report.docx', size_bytes: 999 }],
        });
        render(
            <ConversationTimeline
                messages={[message]}
                attachmentBaseUrl="/tickets/5/attachments"
            />,
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/tickets/5/attachments/42');
    });
});
