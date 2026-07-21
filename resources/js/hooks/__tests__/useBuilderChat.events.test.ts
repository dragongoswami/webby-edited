import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBuilderChat } from '../useBuilderChat';
import axios from 'axios';

// Capture the options passed into useBuilderPusher so we can invoke its
// event handlers directly, bypassing the real Pusher/Echo machinery.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedPusherOpts: any = null;

vi.mock('@/hooks/useBuilderPusher', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useBuilderPusher: (opts: any) => {
        capturedPusherOpts = opts;
        return { subscribe: vi.fn(), unsubscribe: vi.fn() };
    },
}));

vi.mock('@/hooks/useBuilderReverb', () => ({
    useBuilderReverb: () => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }),
}));

vi.mock('axios');

// Global route mock
(global as unknown as { route: (name: string, params?: Record<string, unknown>) => string }).route = (name: string, params?: Record<string, unknown>) => {
    if (name === 'builder.stream' && params?.project) {
        return `/builder/${params.project}/stream`;
    }
    if (name === 'builder.start' && params?.project) {
        return `/builder/${params.project}/start`;
    }
    if (name === 'builder.complete' && params?.project) {
        return `/builder/${params.project}/complete`;
    }
    return `/${name}`;
};

// Mock pusherConfig for tests (no `provider` key -> pusher path is active)
const mockPusherConfig = {
    key: 'test-key',
    cluster: 'mt1',
    forceTLS: true,
    channelPrefix: 'private-project.',
};

describe('useBuilderChat pusher event handlers', () => {
    const mockedAxios = vi.mocked(axios);

    beforeEach(() => {
        capturedPusherOpts = null;

        vi.mocked(axios.post).mockReset();
        vi.mocked(axios.get).mockReset();

        vi.mocked(localStorage.getItem).mockReturnValue(null);
        vi.mocked(localStorage.setItem).mockReset();
        vi.mocked(localStorage.removeItem).mockReset();

        // Mock CSRF token
        const metaElement = document.createElement('meta');
        metaElement.setAttribute('name', 'csrf-token');
        metaElement.setAttribute('content', 'test-csrf-token');
        document.head.appendChild(metaElement);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.head.innerHTML = '';
    });

    it('handleSummarizationComplete adds a compaction activity message', () => {
        const { result } = renderHook(() => useBuilderChat(1, { pusherConfig: mockPusherConfig }));

        expect(capturedPusherOpts).not.toBeNull();

        act(() => {
            capturedPusherOpts.onSummarizationComplete({ turns_compacted: 8, reduction_percent: 42.6 });
        });

        const activityMessage = result.current.messages.find(
            m => m.type === 'activity' && m.activityType === 'compacting',
        );

        expect(activityMessage).toBeDefined();
        expect(activityMessage?.content).toBe('Compressed 8 turns (43% reduction)');
    });

    it('handleWsReconnected is a no-op when not running', async () => {
        const { result } = renderHook(() => useBuilderChat(1, { pusherConfig: mockPusherConfig }));

        expect(result.current.progress.status).toBe('idle');

        await act(async () => {
            await capturedPusherOpts.onReconnected();
        });

        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(result.current.progress.status).toBe('idle');
    });

    it('handleWsReconnected polls and marks completed when running', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { session_id: 'sess-1', builder_id: 1 } });

        const { result } = renderHook(() => useBuilderChat(1, { pusherConfig: mockPusherConfig }));

        await act(async () => {
            await result.current.sendMessage('build');
        });

        act(() => {
            capturedPusherOpts.onStatus({ status: 'running', message: '' });
        });

        expect(result.current.progress.status).toBe('running');

        mockedAxios.get.mockResolvedValueOnce({ data: { status: 'completed' } });

        await act(async () => {
            await capturedPusherOpts.onReconnected();
        });

        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/status?quick=1'));

        await waitFor(() => {
            expect(result.current.progress.status).toBe('completed');
        });
        expect(result.current.progress.hasFileChanges).toBe(true);
    });

    it('handleWsReconnected marks failed when the poll reports failed', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { session_id: 'sess-1', builder_id: 1 } });

        const { result } = renderHook(() => useBuilderChat(1, { pusherConfig: mockPusherConfig }));

        await act(async () => {
            await result.current.sendMessage('build');
        });

        act(() => {
            capturedPusherOpts.onStatus({ status: 'running', message: '' });
        });

        mockedAxios.get.mockResolvedValueOnce({ data: { status: 'failed' } });

        await act(async () => {
            await capturedPusherOpts.onReconnected();
        });

        await waitFor(() => {
            expect(result.current.progress.status).toBe('failed');
        });
    });

    it('handleWsReconnected silently ignores a failed poll request', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { session_id: 'sess-1', builder_id: 1 } });

        const { result } = renderHook(() => useBuilderChat(1, { pusherConfig: mockPusherConfig }));

        await act(async () => {
            await result.current.sendMessage('build');
        });

        act(() => {
            capturedPusherOpts.onStatus({ status: 'running', message: '' });
        });

        mockedAxios.get.mockRejectedValueOnce(new Error('network error'));

        await act(async () => {
            await capturedPusherOpts.onReconnected();
        });

        expect(result.current.progress.status).toBe('running');
    });
});
