import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSessionReconnection } from '../useSessionReconnection';
import type { SessionReconnectionOptions, SessionStatus } from '../useSessionReconnection';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
    },
}));

import axios from 'axios';

// ----- response helpers -----

const activeResponse = () => ({
    data: {
        has_session: true,
        can_reconnect: true,
        build_session_id: 'sess-1',
        status: 'building',
        preview_url: '/preview/x',
    },
});

const inactiveResponse = () => ({
    data: {
        has_session: false,
        can_reconnect: false,
    },
});

// ----- options helper -----

const defaultOptions = (
    overrides: Partial<SessionReconnectionOptions> = {},
): SessionReconnectionOptions => ({
    projectId: 'p1',
    initialCanReconnect: false,
    onReconnected: vi.fn(),
    onSessionNotFound: vi.fn(),
    onReconnectFailed: vi.fn(),
    ...overrides,
});

describe('useSessionReconnection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Default: inactive so any unexpected auto-reconnect call is harmless
        vi.mocked(axios.get).mockResolvedValue(inactiveResponse());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('test_initial_sessionIsActive_reflects_initialCanReconnect', () => {
        // initialCanReconnect:true but no initialSessionId → mount effect requires both, so it won't fire
        const { result: resultTrue } = renderHook(() =>
            useSessionReconnection(defaultOptions({ initialCanReconnect: true })),
        );
        expect(resultTrue.current.sessionIsActive).toBe(true);

        const { result: resultFalse } = renderHook(() =>
            useSessionReconnection(defaultOptions({ initialCanReconnect: false })),
        );
        expect(resultFalse.current.sessionIsActive).toBe(false);
    });

    it('test_check_session_status_returns_mapped_status_when_active', async () => {
        vi.mocked(axios.get).mockResolvedValue(activeResponse());
        const { result } = renderHook(() => useSessionReconnection(defaultOptions()));

        let res: SessionStatus | null = null;
        await act(async () => {
            res = await result.current.checkSessionStatus();
        });

        expect(res).toEqual({
            sessionId: 'sess-1',
            status: 'building',
            canReconnect: true,
            previewUrl: '/preview/x',
        });
        expect(result.current.sessionIsActive).toBe(true);
        expect(vi.mocked(axios.get)).toHaveBeenCalledWith('/builder/projects/p1/status');
    });

    it('test_check_session_status_returns_null_when_inactive', async () => {
        vi.mocked(axios.get).mockResolvedValue(inactiveResponse());
        const { result } = renderHook(() => useSessionReconnection(defaultOptions()));

        let res: SessionStatus | null = null;
        await act(async () => {
            res = await result.current.checkSessionStatus();
        });

        expect(res).toBeNull();
        expect(result.current.sessionIsActive).toBe(false);
    });

    it('test_check_session_status_returns_null_when_has_session_but_not_reconnectable', async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: { has_session: true, can_reconnect: false },
        });
        const { result } = renderHook(() => useSessionReconnection(defaultOptions()));

        let res: SessionStatus | null = null;
        await act(async () => {
            res = await result.current.checkSessionStatus();
        });

        expect(res).toBeNull();
        expect(result.current.sessionIsActive).toBe(false);
    });

    it('test_check_session_status_returns_null_on_axios_error', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('network error'));
        const { result } = renderHook(() => useSessionReconnection(defaultOptions()));

        let res: SessionStatus | null = null;
        await act(async () => {
            res = await result.current.checkSessionStatus();
        });

        expect(res).toBeNull();
        expect(result.current.sessionIsActive).toBe(false);
    });

    it('test_reconnect_success_calls_onReconnected_and_increments_attempt', async () => {
        vi.mocked(axios.get).mockResolvedValue(activeResponse());
        const onReconnected = vi.fn();
        const { result } = renderHook(() =>
            useSessionReconnection(defaultOptions({ onReconnected })),
        );

        await act(async () => {
            await result.current.reconnect();
        });

        expect(onReconnected).toHaveBeenCalledTimes(1);
        expect(onReconnected).toHaveBeenCalledWith({
            sessionId: 'sess-1',
            status: 'building',
            canReconnect: true,
            previewUrl: '/preview/x',
        });
        expect(result.current.reconnectAttempt).toBe(1);
        expect(result.current.sessionIsActive).toBe(true);
        expect(result.current.isReconnecting).toBe(false);
    });

    it('test_reconnect_not_found_calls_onSessionNotFound', async () => {
        vi.mocked(axios.get).mockResolvedValue(inactiveResponse());
        const onReconnected = vi.fn();
        const onSessionNotFound = vi.fn();
        const { result } = renderHook(() =>
            useSessionReconnection(defaultOptions({ onReconnected, onSessionNotFound })),
        );

        await act(async () => {
            await result.current.reconnect();
        });

        expect(onSessionNotFound).toHaveBeenCalledTimes(1);
        expect(onReconnected).not.toHaveBeenCalled();
        expect(result.current.sessionIsActive).toBe(false);
        expect(result.current.reconnectAttempt).toBe(0);
    });

    it('test_reconnect_one_shot_guard_after_success', async () => {
        vi.mocked(axios.get).mockResolvedValue(activeResponse());
        const onReconnected = vi.fn();
        const { result } = renderHook(() =>
            useSessionReconnection(defaultOptions({ onReconnected })),
        );

        // First call succeeds and sets the one-shot ref
        await act(async () => {
            await result.current.reconnect();
        });
        // Second call early-returns because hasAttemptedReconnect is already set
        await act(async () => {
            await result.current.reconnect();
        });

        expect(onReconnected).toHaveBeenCalledTimes(1);
        expect(result.current.reconnectAttempt).toBe(1);
    });

    it('test_reconnect_allows_retry_after_not_found', async () => {
        const onReconnected = vi.fn();
        const onSessionNotFound = vi.fn();
        const { result } = renderHook(() =>
            useSessionReconnection(defaultOptions({ onReconnected, onSessionNotFound })),
        );

        // First call: inactive → onSessionNotFound, ref reset to false
        vi.mocked(axios.get).mockResolvedValueOnce(inactiveResponse());
        await act(async () => {
            await result.current.reconnect();
        });

        expect(onSessionNotFound).toHaveBeenCalledTimes(1);
        expect(onReconnected).not.toHaveBeenCalled();

        // Second call: active → onReconnected (retry allowed because ref was reset)
        vi.mocked(axios.get).mockResolvedValueOnce(activeResponse());
        await act(async () => {
            await result.current.reconnect();
        });

        expect(onSessionNotFound).toHaveBeenCalledTimes(1);
        expect(onReconnected).toHaveBeenCalledTimes(1);
    });

    it('test_reconnect_early_returns_when_no_projectId', async () => {
        const onReconnected = vi.fn();
        const onSessionNotFound = vi.fn();
        const { result } = renderHook(() =>
            useSessionReconnection(
                defaultOptions({ projectId: '', onReconnected, onSessionNotFound }),
            ),
        );

        await act(async () => {
            await result.current.reconnect();
        });

        expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
        expect(onReconnected).not.toHaveBeenCalled();
        expect(onSessionNotFound).not.toHaveBeenCalled();
        expect(result.current.isReconnecting).toBe(false);
    });

    it('test_auto_reconnect_on_mount_when_initial_session_active', async () => {
        vi.mocked(axios.get).mockResolvedValue(activeResponse());
        const onReconnected = vi.fn();

        const { result } = renderHook(() =>
            useSessionReconnection(
                defaultOptions({
                    initialCanReconnect: true,
                    initialSessionId: 'sess-1',
                    onReconnected,
                }),
            ),
        );

        await waitFor(() => expect(onReconnected).toHaveBeenCalledTimes(1));
        expect(result.current.reconnectAttempt).toBe(1);
    });

    it('test_no_auto_reconnect_when_initial_not_reconnectable', async () => {
        const onReconnected = vi.fn();

        renderHook(() =>
            useSessionReconnection(
                defaultOptions({
                    initialCanReconnect: false,
                    initialSessionId: 'sess-1',
                    onReconnected,
                }),
            ),
        );

        // Flush any pending microtasks / effects
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
        expect(onReconnected).not.toHaveBeenCalled();
    });
});
