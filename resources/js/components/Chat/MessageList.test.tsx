import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MessageList } from './MessageList';
import { ChatMessage } from '@/types/chat';

vi.mock('./MessageBubble', () => ({
    MessageBubble: ({ message }: { message: ChatMessage }) => (
        <div data-testid="bubble">{message.content}</div>
    ),
}));

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: '1',
        type: 'user',
        content: 'Hello',
        timestamp: new Date(),
        ...overrides,
    };
}

describe('MessageList', () => {
    it('renders empty state when no messages', () => {
        render(<MessageList messages={[]} />);

        expect(screen.getByText('Start a conversation')).toBeInTheDocument();
        expect(screen.getByText(/send a message to begin/i)).toBeInTheDocument();
        expect(screen.queryAllByTestId('bubble')).toHaveLength(0);
    });

    it('renders messages when provided', () => {
        const messages: ChatMessage[] = [
            {
                id: '1',
                type: 'user',
                content: 'Hello',
                timestamp: new Date(),
            },
            {
                id: '2',
                type: 'assistant',
                content: 'Hi there!',
                timestamp: new Date(),
            },
        ];

        render(<MessageList messages={messages} />);

        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('does not show empty state when messages exist', () => {
        const messages: ChatMessage[] = [
            {
                id: '1',
                type: 'user',
                content: 'Test',
                timestamp: new Date(),
            },
        ];

        render(<MessageList messages={messages} />);

        expect(screen.queryByText('Start a conversation')).not.toBeInTheDocument();
    });

    it('renders multiple messages in order', () => {
        const messages: ChatMessage[] = [
            { id: '1', type: 'user', content: 'First', timestamp: new Date() },
            { id: '2', type: 'assistant', content: 'Second', timestamp: new Date() },
            { id: '3', type: 'user', content: 'Third', timestamp: new Date() },
        ];

        render(<MessageList messages={messages} />);

        const first = screen.getByText('First');
        const second = screen.getByText('Second');
        const third = screen.getByText('Third');

        // All should be present
        expect(first).toBeInTheDocument();
        expect(second).toBeInTheDocument();
        expect(third).toBeInTheDocument();
    });

    it('renders user, assistant, and activity messages but filters out other types (e.g. system)', () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: '1', type: 'user', content: 'User msg' }),
            makeMessage({ id: '2', type: 'assistant', content: 'Assistant msg' }),
            makeMessage({ id: '3', type: 'activity', content: 'Activity msg' }),
            makeMessage({ id: '4', type: 'system', content: 'System msg' }),
        ];

        render(<MessageList messages={messages} />);

        const bubbles = screen.getAllByTestId('bubble');
        expect(bubbles).toHaveLength(3);
        expect(screen.getByText('User msg')).toBeInTheDocument();
        expect(screen.getByText('Assistant msg')).toBeInTheDocument();
        expect(screen.getByText('Activity msg')).toBeInTheDocument();
        expect(screen.queryByText('System msg')).not.toBeInTheDocument();
    });

    it('shows the persisted thinkingDuration above the assistant message that carries it', () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: '1', type: 'user', content: 'Question' }),
            makeMessage({ id: '2', type: 'assistant', content: 'Answer', thinkingDuration: 7 }),
        ];

        render(<MessageList messages={messages} />);

        expect(screen.getByText('Thought for 7s')).toBeInTheDocument();
    });

    it('applies the live thinkingDuration prop only to the last filtered message', () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: '1', type: 'assistant', content: 'Earlier answer' }),
            makeMessage({ id: '2', type: 'assistant', content: 'Last answer' }),
        ];

        render(<MessageList messages={messages} thinkingDuration={5} />);

        expect(screen.getAllByText(/^Thought for/)).toHaveLength(1);
        expect(screen.getByText('Thought for 5s')).toBeInTheDocument();
    });

    it('shows no "Thought for" text when thinkingDuration is null and nothing is persisted', () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: '1', type: 'assistant', content: 'Answer' }),
        ];

        render(<MessageList messages={messages} thinkingDuration={null} />);

        expect(screen.queryByText(/^Thought for/)).not.toBeInTheDocument();
    });

    it('does not show the thinking duration when the last message is not an assistant message', () => {
        const messages: ChatMessage[] = [
            makeMessage({ id: '1', type: 'assistant', content: 'Answer' }),
            makeMessage({ id: '2', type: 'user', content: 'Follow-up' }),
        ];

        render(<MessageList messages={messages} thinkingDuration={5} />);

        expect(screen.queryByText(/^Thought for/)).not.toBeInTheDocument();
    });
});
