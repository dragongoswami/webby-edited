import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatContainer } from './ChatContainer';
import { useBuilderChat } from '@/hooks/useBuilderChat';
import type { UseBuilderChatReturn, BuildProgress, PusherConfig } from '@/hooks/useBuilderChat';
import type { ActionEvent } from '@/hooks/useBuilderPusher';
import type { ChatMessage } from '@/hooks/useChatHistory';

vi.mock('@/hooks/useBuilderChat', () => ({
    useBuilderChat: vi.fn(),
}));

vi.mock('./MessageList', () => ({
    MessageList: ({ messages, thinkingDuration }: { messages: unknown[]; thinkingDuration: number | null }) => (
        <div data-testid="list" data-duration={String(thinkingDuration)}>{messages.length}</div>
    ),
}));

vi.mock('./ChatInput', () => ({
    ChatInput: ({ onSend, disabled, onCancel }: { onSend: (v: string) => void; disabled?: boolean; onCancel?: () => void }) => (
        <div>
            <button onClick={() => onSend('typed')}>Send</button>
            <button onClick={() => onCancel?.()}>Cancel</button>
            <span data-testid="disabled">{String(!!disabled)}</span>
            <span data-testid="has-cancel">{String(!!onCancel)}</span>
        </div>
    ),
}));

const mockedUseBuilderChat = vi.mocked(useBuilderChat);

const pusherConfig: PusherConfig = { provider: 'pusher', key: 'k', cluster: 'c' };

function makeProgress(overrides: Partial<BuildProgress> = {}): BuildProgress {
    return {
        status: 'idle',
        iterations: 0,
        tokensUsed: 0,
        hasFileChanges: false,
        messages: [],
        actions: [],
        thinkingContent: null,
        thinkingStartTime: null,
        error: null,
        previewUrl: null,
        ...overrides,
    };
}

function makeAction(overrides: Partial<ActionEvent> = {}): ActionEvent {
    return {
        action: 'Creating',
        target: 'src/App.tsx',
        details: '',
        category: 'creating',
        ...overrides,
    };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: '1',
        type: 'user',
        content: 'Hello',
        timestamp: new Date(),
        ...overrides,
    };
}

describe('ChatContainer', () => {
    let hookReturn: UseBuilderChatReturn;
    const sendMessage = vi.fn();
    const cancelBuild = vi.fn();

    beforeEach(() => {
        sendMessage.mockClear();
        cancelBuild.mockClear();
        hookReturn = {
            messages: [],
            progress: makeProgress(),
            isLoading: false,
            isStarting: false,
            isBuildingPreview: false,
            sessionId: null,
            startError: null,
            sendMessage,
            cancelBuild,
            clearHistory: vi.fn(),
            triggerBuild: vi.fn(),
            isReconnecting: false,
            reconnectAttempt: 0,
            manualReconnect: vi.fn(),
        };
        mockedUseBuilderChat.mockImplementation(() => hookReturn);
    });

    it('renders MessageList with mapped messages and ChatInput', () => {
        hookReturn.messages = [makeMessage({ id: '1' }), makeMessage({ id: '2' })];

        render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.getByTestId('list')).toHaveTextContent('2');
        expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('auto-sends the initial message exactly once, even across rerenders', () => {
        const { rerender } = render(
            <ChatContainer projectId="p1" pusherConfig={pusherConfig} initialMessage="build a site" />
        );

        expect(sendMessage).toHaveBeenCalledTimes(1);
        expect(sendMessage).toHaveBeenCalledWith('build a site');

        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} initialMessage="build a site" />);

        expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('does not auto-send when no initialMessage is provided', () => {
        render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(sendMessage).not.toHaveBeenCalled();
    });

    it('computes the thinking duration when the build completes', () => {
        // Anchor thinkingStartTime 5s in the past relative to the real clock;
        // the effect's own Date.now() call happens milliseconds later, so the
        // rounded duration reliably comes out to 5. The real useBuilderChat
        // hook always clears thinkingStartTime back to null in the same
        // progress update that flips status to 'completed' (it latches into
        // local state before that), so the mocked progress here mirrors that.
        const start = Date.now() - 5000;

        hookReturn.progress = makeProgress({ status: 'running', thinkingStartTime: start });
        const { rerender } = render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);
        expect(screen.getByTestId('list')).toHaveAttribute('data-duration', 'null');

        hookReturn.progress = makeProgress({ status: 'completed', thinkingStartTime: null });
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.getByTestId('list')).toHaveAttribute('data-duration', '5');
    });

    it('resets the thinking duration when a new build starts connecting', () => {
        const start = Date.now() - 5000;

        hookReturn.progress = makeProgress({ status: 'running', thinkingStartTime: start });
        const { rerender } = render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        hookReturn.progress = makeProgress({ status: 'completed', thinkingStartTime: null });
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);
        expect(screen.getByTestId('list')).toHaveAttribute('data-duration', '5');

        hookReturn.progress = makeProgress({ status: 'connecting' });
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.getByTestId('list')).toHaveAttribute('data-duration', 'null');
    });

    it('shows the "AI is working" pill with the current activity only while loading', () => {
        hookReturn.isLoading = true;
        hookReturn.progress = makeProgress({ actions: [makeAction({ action: 'Creating', target: 'src/App.tsx' })] });
        const { rerender } = render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.getByText('AI is working')).toBeInTheDocument();
        expect(screen.getByText('Creating src/App.tsx')).toBeInTheDocument();

        hookReturn.isLoading = false;
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.queryByText('AI is working')).not.toBeInTheDocument();
    });

    it('falls back to thinkingContent, then to "Starting...", and omits the target when absent', () => {
        hookReturn.isLoading = true;
        hookReturn.progress = makeProgress({ actions: [], thinkingContent: 'Pondering' });
        const { rerender } = render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);
        expect(screen.getByText('Pondering')).toBeInTheDocument();

        hookReturn.progress = makeProgress({ actions: [], thinkingContent: null });
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);
        expect(screen.getByText('Starting...')).toBeInTheDocument();

        hookReturn.progress = makeProgress({ actions: [makeAction({ action: 'Creating', target: '' })] });
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);
        expect(screen.getByText('Creating')).toBeInTheDocument();
    });

    it('wires ChatInput send to sendMessage', () => {
        render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        fireEvent.click(screen.getByText('Send'));

        expect(sendMessage).toHaveBeenCalledWith('typed');
    });

    it('wires ChatInput cancel to cancelBuild only while loading', () => {
        hookReturn.isLoading = true;
        const { rerender } = render(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.getByTestId('has-cancel')).toHaveTextContent('true');
        expect(screen.getByTestId('disabled')).toHaveTextContent('true');

        fireEvent.click(screen.getByText('Cancel'));
        expect(cancelBuild).toHaveBeenCalledTimes(1);

        hookReturn.isLoading = false;
        rerender(<ChatContainer projectId="p1" pusherConfig={pusherConfig} />);

        expect(screen.getByTestId('has-cancel')).toHaveTextContent('false');
        expect(screen.getByTestId('disabled')).toHaveTextContent('false');
    });
});
