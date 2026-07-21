import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBuilderReverb } from '../useBuilderReverb';

// Mock Pusher
const mockUnbindAll = vi.fn();
const mockBind = vi.fn();
const mockChannel = {
    bind: mockBind,
    unbind_all: mockUnbindAll,
};

const mockSubscribe = vi.fn().mockReturnValue(mockChannel);
const mockUnsubscribe = vi.fn();
const mockConnectionBind = vi.fn();
const mockConnectionUnbind = vi.fn();
const mockDisconnect = vi.fn();

function MockPusher() {
    return {
        subscribe: mockSubscribe,
        unsubscribe: mockUnsubscribe,
        connection: { bind: mockConnectionBind, unbind: mockConnectionUnbind },
        disconnect: mockDisconnect,
    };
}

vi.mock('pusher-js', () => ({
    default: MockPusher,
}));

// Unique config key per test to avoid module-level pusherInstances cache
let configCounter = 0;

function getConfig() {
    return {
        reverbConfig: {
            provider: 'reverb' as const,
            key: `test-key-${configCounter}`,
            host: 'localhost',
            port: 6001,
            scheme: 'http' as const,
        },
        enabled: true,
    };
}

describe('useBuilderReverb', () => {
    beforeEach(() => {
        mockUnbindAll.mockClear();
        mockBind.mockClear();
        mockSubscribe.mockClear().mockReturnValue(mockChannel);
        mockUnsubscribe.mockClear();
        mockConnectionBind.mockClear();
        mockConnectionUnbind.mockClear();
        mockDisconnect.mockClear();
        configCounter++;
    });

    it('calls unbind_all before unsubscribing on explicit unsubscribe', () => {
        const config = getConfig();
        const { result } = renderHook(() => useBuilderReverb(config));

        act(() => {
            result.current.subscribe('session-1');
        });
        expect(mockSubscribe).toHaveBeenCalledWith('session.session-1');

        mockUnbindAll.mockClear();

        act(() => {
            result.current.unsubscribe();
        });

        expect(mockUnbindAll).toHaveBeenCalled();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('calls unbind_all when switching channels', () => {
        const config = getConfig();
        const { result } = renderHook(() => useBuilderReverb(config));

        act(() => {
            result.current.subscribe('session-a');
        });

        mockUnbindAll.mockClear();

        act(() => {
            result.current.subscribe('session-b');
        });

        // Should have called unbind_all on the previous channel before subscribing to new
        expect(mockUnbindAll).toHaveBeenCalled();
    });

    it('calls unbind_all on unmount', () => {
        const config = getConfig();
        const { result, unmount } = renderHook(() => useBuilderReverb(config));

        act(() => {
            result.current.subscribe('session-1');
        });

        mockUnbindAll.mockClear();

        unmount();

        expect(mockUnbindAll).toHaveBeenCalled();
    });
});
