import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBuilderPusher } from '../useBuilderPusher';
import type { UseBuilderPusherOptions } from '../useBuilderPusher';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Chainable channel: .listen(event, cb) stores cb and returns the channel itself
const listeners: Record<string, (d: unknown) => void> = {};

const mockChannel = { listen: vi.fn() };
mockChannel.listen.mockImplementation((event: string, cb: (d: unknown) => void) => {
    listeners[event] = cb;
    return mockChannel;
});

const mockEchoChannel = vi.fn(() => mockChannel);
const mockEchoLeave = vi.fn();
const connBind = vi.fn();
const connUnbind = vi.fn();

const mockEcho = {
    channel: mockEchoChannel,
    leave: mockEchoLeave,
    connector: { pusher: { connection: { bind: connBind, unbind: connUnbind } } },
};

// Mock Echo as a constructor (must use function, not arrow, to support `new`)
vi.mock('laravel-echo', () => ({
    default: vi.fn().mockImplementation(function () { return mockEcho; }),
}));

// Pusher is only assigned to window.Pusher — a no-op mock is sufficient
vi.mock('pusher-js', () => ({ default: vi.fn() }));

// ---------------------------------------------------------------------------
// Per-test key counter — busts the module-level echoInstances cache so each
// test gets a fresh `new Echo(...)` call and clean connector state.
// ---------------------------------------------------------------------------
let keyCounter = 0;

const baseOptions = (over: Partial<UseBuilderPusherOptions> = {}): UseBuilderPusherOptions => ({
    pusherConfig: { provider: 'pusher' as const, key: `test-key-${keyCounter}`, cluster: 'mt1' },
    enabled: true,
    ...over,
});

describe('useBuilderPusher', () => {
    beforeEach(() => {
        // Clear the listeners store
        Object.keys(listeners).forEach((k) => delete listeners[k]);

        // Reset mock call histories (implementations are preserved)
        mockChannel.listen.mockClear();
        mockChannel.listen.mockImplementation((event: string, cb: (d: unknown) => void) => {
            listeners[event] = cb;
            return mockChannel;
        });
        mockEchoChannel.mockClear();
        mockEchoChannel.mockReturnValue(mockChannel);
        mockEchoLeave.mockClear();
        connBind.mockClear();
        connUnbind.mockClear();

        // Fresh config key per test → new echoInstances cache entry → new Echo()
        keyCounter++;
    });

    // -----------------------------------------------------------------------
    // 1. subscribe creates the channel and registers all 9 events
    // -----------------------------------------------------------------------
    it('test_subscribe_creates_channel_and_binds_all_events', () => {
        const { result } = renderHook(() => useBuilderPusher(baseOptions()));

        act(() => {
            result.current.subscribe('s1');
        });

        expect(mockEchoChannel).toHaveBeenCalledWith('session.s1');

        const expectedEvents = [
            '.status',
            '.thinking',
            '.action',
            '.tool_call',
            '.tool_result',
            '.message',
            '.error',
            '.complete',
            '.summarization_complete',
        ];
        expectedEvents.forEach((event) => {
            expect(Object.keys(listeners)).toContain(event);
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.error).toBeNull();
    });

    // -----------------------------------------------------------------------
    // 2. subscribe is a no-op when disabled or session id is empty
    // -----------------------------------------------------------------------
    it('test_subscribe_noop_when_disabled_or_empty_session', () => {
        // Case 1: enabled = false
        const { result: r1 } = renderHook(() =>
            useBuilderPusher(baseOptions({ enabled: false }))
        );
        act(() => {
            r1.current.subscribe('s1');
        });
        expect(mockEchoChannel).not.toHaveBeenCalled();

        // Use a fresh key for the second hook
        keyCounter++;
        mockEchoChannel.mockClear();

        // Case 2: empty session id
        const { result: r2 } = renderHook(() => useBuilderPusher(baseOptions()));
        act(() => {
            r2.current.subscribe('');
        });
        expect(mockEchoChannel).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 3. subscribe with empty key sets error and does NOT call channel
    // -----------------------------------------------------------------------
    it('test_subscribe_sets_error_when_pusher_not_configured', () => {
        const { result } = renderHook(() =>
            useBuilderPusher({
                pusherConfig: { provider: 'pusher' as const, key: '', cluster: 'mt1' },
                enabled: true,
            })
        );

        act(() => {
            result.current.subscribe('s1');
        });

        expect(result.current.error).toBe(
            'Pusher is not configured. Please configure Pusher in Admin Settings.'
        );
        expect(mockEchoChannel).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // 4. subscribing to the same session twice does not recreate the channel
    // -----------------------------------------------------------------------
    it('test_resubscribe_same_session_does_not_recreate_channel', () => {
        const { result } = renderHook(() => useBuilderPusher(baseOptions()));

        act(() => {
            result.current.subscribe('s1');
        });
        act(() => {
            result.current.subscribe('s1');
        });

        expect(mockEchoChannel).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------------
    // 5. switching sessions leaves the previous channel first
    // -----------------------------------------------------------------------
    it('test_switching_session_leaves_previous_channel', () => {
        const { result } = renderHook(() => useBuilderPusher(baseOptions()));

        act(() => {
            result.current.subscribe('s1');
        });
        act(() => {
            result.current.subscribe('s2');
        });

        expect(mockEchoLeave).toHaveBeenCalledWith('session.s1');
        expect(mockEchoChannel).toHaveBeenCalledTimes(2);
        expect(mockEchoChannel).toHaveBeenLastCalledWith('session.s2');
    });

    // -----------------------------------------------------------------------
    // 6. event dispatch calls the correct per-event and onAnyEvent callbacks
    // -----------------------------------------------------------------------
    it('test_event_dispatch_invokes_callbacks', () => {
        const onStatus = vi.fn();
        const onComplete = vi.fn();
        const onAnyEvent = vi.fn();

        const { result } = renderHook(() =>
            useBuilderPusher(baseOptions({ onStatus, onComplete, onAnyEvent }))
        );

        act(() => {
            result.current.subscribe('s1');
        });

        // Fire .status
        const statusData = { status: 'building', message: 'x' };
        act(() => {
            listeners['.status'](statusData);
        });
        expect(onStatus).toHaveBeenCalledWith(statusData);
        expect(onAnyEvent).toHaveBeenCalledWith({ type: 'status', data: statusData });

        // Fire .complete
        const completeData = { iterations: 1, tokens_used: 100, files_changed: false };
        act(() => {
            listeners['.complete'](completeData);
        });
        expect(onComplete).toHaveBeenCalledWith(completeData);
        expect(onAnyEvent).toHaveBeenCalledWith({ type: 'complete', data: completeData });
    });

    // -----------------------------------------------------------------------
    // 7. unsubscribe leaves the channel and clears connection state
    // -----------------------------------------------------------------------
    it('test_unsubscribe_leaves_channel', () => {
        const { result } = renderHook(() => useBuilderPusher(baseOptions()));

        act(() => {
            result.current.subscribe('s1');
        });
        act(() => {
            result.current.unsubscribe();
        });

        expect(mockEchoLeave).toHaveBeenCalledWith('session.s1');
        expect(result.current.isConnected).toBe(false);
    });

    // -----------------------------------------------------------------------
    // 8. unmounting the hook leaves the current channel
    // -----------------------------------------------------------------------
    it('test_unmount_leaves_channel', () => {
        const { result, unmount } = renderHook(() => useBuilderPusher(baseOptions()));

        act(() => {
            result.current.subscribe('s1');
        });

        unmount();

        expect(mockEchoLeave).toHaveBeenCalledWith('session.s1');
    });

    // -----------------------------------------------------------------------
    // 9. connection bind fires on mount; handlers update state + call back
    // -----------------------------------------------------------------------
    it('test_connection_bind_on_mount_and_handlers', () => {
        const onReconnected = vi.fn();
        const onDisconnected = vi.fn();

        const { result } = renderHook(() =>
            useBuilderPusher(baseOptions({ onReconnected, onDisconnected }))
        );

        // The connection effect should have bound both events on mount
        expect(connBind).toHaveBeenCalledWith('disconnected', expect.any(Function));
        expect(connBind).toHaveBeenCalledWith('connected', expect.any(Function));

        // Extract the actual handlers from the bind calls
        const connectedCall = connBind.mock.calls.find(([event]) => event === 'connected');
        const disconnectedCall = connBind.mock.calls.find(([event]) => event === 'disconnected');
        const connectedHandler = connectedCall?.[1] as () => void;
        const disconnectedHandler = disconnectedCall?.[1] as () => void;

        // Simulate 'connected' → onReconnected + isConnected = true
        act(() => {
            connectedHandler();
        });
        expect(onReconnected).toHaveBeenCalled();
        expect(result.current.isConnected).toBe(true);

        // Simulate 'disconnected' → onDisconnected + isConnected = false
        act(() => {
            disconnectedHandler();
        });
        expect(onDisconnected).toHaveBeenCalled();
        expect(result.current.isConnected).toBe(false);
    });

    // -----------------------------------------------------------------------
    // 10. unmounting unbinds both connection handlers
    // -----------------------------------------------------------------------
    it('test_connection_unbinds_on_cleanup', () => {
        const { unmount } = renderHook(() => useBuilderPusher(baseOptions()));

        unmount();

        expect(connUnbind).toHaveBeenCalledWith('disconnected', expect.any(Function));
        expect(connUnbind).toHaveBeenCalledWith('connected', expect.any(Function));
    });
});
