import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotifications } from '../useNotifications';
import type { UserNotification } from '@/types/notifications';

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

import axios from 'axios';

const createNotification = (overrides: Partial<UserNotification> = {}): UserNotification => ({
    id: 1,
    type: 'credits_low',
    title: 'Credits Running Low',
    message: 'You have less than 20% of your monthly credits remaining.',
    data: null,
    action_url: '/billing',
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
});

describe('useNotifications', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // Default mock for fetch
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                notifications: [],
                unread_count: 0,
            },
        });
        vi.mocked(axios.post).mockResolvedValue({ data: {} });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes with provided unread count', () => {
        const { result } = renderHook(() => useNotifications(5));
        expect(result.current.unreadCount).toBe(5);
    });

    it('initializes with empty notifications', () => {
        const { result } = renderHook(() => useNotifications(0));
        expect(result.current.notifications).toEqual([]);
    });

    it('fetches notifications on mount', async () => {
        renderHook(() => useNotifications(0));

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith('/api/notifications');
        });
    });

    it('adds notification to the beginning of the list', () => {
        const { result } = renderHook(() => useNotifications(0));

        const newNotification = createNotification({ id: 1 });
        act(() => {
            result.current.addNotification(newNotification);
        });

        expect(result.current.notifications[0]).toEqual(newNotification);
        expect(result.current.unreadCount).toBe(1);
    });

    it('increments unread count when adding notification', () => {
        const { result } = renderHook(() => useNotifications(2));

        act(() => {
            result.current.addNotification(createNotification({ id: 1 }));
        });

        expect(result.current.unreadCount).toBe(3);
    });

    it('calls markAsRead API', async () => {
        const { result } = renderHook(() => useNotifications(1));

        await act(async () => {
            await result.current.markAsRead(1);
        });

        expect(axios.post).toHaveBeenCalledWith('/api/notifications/1/read');
    });

    it('calls markAllAsRead API', async () => {
        const { result } = renderHook(() => useNotifications(3));

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(axios.post).toHaveBeenCalledWith('/api/notifications/read-all');
    });

    it('returns isLoading state', () => {
        const { result } = renderHook(() => useNotifications(0));
        expect(result.current).toHaveProperty('isLoading');
    });

    it('returns notifications array', () => {
        const { result } = renderHook(() => useNotifications(0));
        expect(Array.isArray(result.current.notifications)).toBe(true);
    });

    it('returns unreadCount number', () => {
        const { result } = renderHook(() => useNotifications(5));
        expect(typeof result.current.unreadCount).toBe('number');
    });

    it('returns markAsRead function', () => {
        const { result } = renderHook(() => useNotifications(0));
        expect(typeof result.current.markAsRead).toBe('function');
    });

    it('returns markAllAsRead function', () => {
        const { result } = renderHook(() => useNotifications(0));
        expect(typeof result.current.markAllAsRead).toBe('function');
    });

    it('returns addNotification function', () => {
        const { result } = renderHook(() => useNotifications(0));
        expect(typeof result.current.addNotification).toBe('function');
    });

    it('ignores build_complete notifications in addNotification', () => {
        const { result } = renderHook(() => useNotifications(0));

        act(() => {
            result.current.addNotification(createNotification({ id: 1, type: 'build_complete' }));
        });

        expect(result.current.notifications).toHaveLength(0);
        expect(result.current.unreadCount).toBe(0);
    });

    it('ignores build_failed notifications in addNotification', () => {
        const { result } = renderHook(() => useNotifications(0));

        act(() => {
            result.current.addNotification(createNotification({ id: 1, type: 'build_failed' }));
        });

        expect(result.current.notifications).toHaveLength(0);
        expect(result.current.unreadCount).toBe(0);
    });

    // ----------------------------------------------------------------
    // New behavioral cases
    // ----------------------------------------------------------------

    it('test_initial_fetch_populates_state: fetch result is reflected in state', async () => {
        const notification = createNotification({ id: 1 });
        vi.mocked(axios.get).mockResolvedValue({
            data: { notifications: [notification], unread_count: 3 },
        });

        const { result } = renderHook(() => useNotifications(0));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.unreadCount).toBe(3);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(axios.get).toHaveBeenCalledWith('/api/notifications');
    });

    it('test_uses_initial_unread_count_before_fetch: rejected fetch leaves unreadCount at initial value', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('network error'));

        const { result } = renderHook(() => useNotifications(7));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // After a failed fetch the count stays at the seed value passed to the hook
        expect(result.current.unreadCount).toBe(7);
    });

    it('test_fetch_error_sets_error_message: axios.get rejection surfaces the error string', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('network error'));

        const { result } = renderHook(() => useNotifications(0));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBe('Failed to load notifications');
        expect(result.current.notifications).toEqual([]);
    });

    it('test_add_notification_already_read_does_not_increment: read_at set → unreadCount unchanged', async () => {
        const { result } = renderHook(() => useNotifications(0));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.addNotification(
                createNotification({ id: 5, read_at: '2024-01-01T00:00:00.000Z' }),
            );
        });

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.unreadCount).toBe(0);
    });

    it('test_mark_as_read_updates_notification_and_count: notification marked read, count from response', async () => {
        const notification = createNotification({ id: 9, read_at: null });
        vi.mocked(axios.get).mockResolvedValue({
            data: { notifications: [notification], unread_count: 1 },
        });
        vi.mocked(axios.post).mockResolvedValue({ data: { unread_count: 0 } });

        const { result } = renderHook(() => useNotifications(1));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.markAsRead(9);
        });

        const updated = result.current.notifications.find(n => n.id === 9);
        expect(updated?.read_at).not.toBeNull();
        expect(result.current.unreadCount).toBe(0);
        expect(axios.post).toHaveBeenCalledWith('/api/notifications/9/read');
    });

    it('test_mark_as_read_error_is_swallowed: post rejection does not throw and state is unchanged', async () => {
        const notification = createNotification({ id: 9, read_at: null });
        vi.mocked(axios.get).mockResolvedValue({
            data: { notifications: [notification], unread_count: 1 },
        });
        vi.mocked(axios.post).mockRejectedValue(new Error('network error'));

        const { result } = renderHook(() => useNotifications(1));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.markAsRead(9);
        });

        const unchanged = result.current.notifications.find(n => n.id === 9);
        expect(unchanged?.read_at).toBeNull();
        expect(result.current.unreadCount).toBe(1);
    });

    it('test_mark_all_as_read_marks_all_and_zeroes_count: all set, existing read_at preserved, count zeroed', async () => {
        const alreadyRead = createNotification({ id: 1, read_at: '2024-01-01T00:00:00.000Z' });
        const unread = createNotification({ id: 2, read_at: null });
        vi.mocked(axios.get).mockResolvedValue({
            data: { notifications: [alreadyRead, unread], unread_count: 1 },
        });
        vi.mocked(axios.post).mockResolvedValue({ data: {} });

        const { result } = renderHook(() => useNotifications(1));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(result.current.notifications.every(n => n.read_at !== null)).toBe(true);

        // The already-read notification keeps its original timestamp
        const originallyRead = result.current.notifications.find(n => n.id === 1);
        expect(originallyRead?.read_at).toBe('2024-01-01T00:00:00.000Z');

        expect(result.current.unreadCount).toBe(0);
        expect(axios.post).toHaveBeenCalledWith('/api/notifications/read-all');
    });

    it('test_mark_all_as_read_error_is_swallowed: post rejection does not throw and state is unchanged', async () => {
        const unread = createNotification({ id: 1, read_at: null });
        vi.mocked(axios.get).mockResolvedValue({
            data: { notifications: [unread], unread_count: 1 },
        });
        vi.mocked(axios.post).mockRejectedValue(new Error('network error'));

        const { result } = renderHook(() => useNotifications(1));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.markAllAsRead();
        });

        expect(result.current.unreadCount).toBe(1);
        expect(result.current.notifications[0].read_at).toBeNull();
    });

    it('test_refetch_reloads: refetch() fetches fresh data and updates state', async () => {
        const { result } = renderHook(() => useNotifications(0));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.notifications).toHaveLength(0);

        const newNotification = createNotification({ id: 10 });
        vi.mocked(axios.get).mockResolvedValue({
            data: { notifications: [newNotification], unread_count: 5 },
        });

        await act(async () => {
            await result.current.refetch();
        });

        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.unreadCount).toBe(5);
        expect(axios.get).toHaveBeenCalledTimes(2);
    });
});
