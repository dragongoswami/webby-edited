import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAdminTicketsChannel } from '../useAdminTicketsChannel';

type Payload = { reference: string; subject: string };
type EchoWindow = Window & {
    Echo?: {
        private: (channel: string) => {
            listen: (event: string, cb: (payload: Payload) => void) => void;
        };
        leave: (channel: string) => void;
    };
};

describe('useAdminTicketsChannel', () => {
    let listen: ReturnType<typeof vi.fn>;
    let privateFn: ReturnType<typeof vi.fn>;
    let leave: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        listen = vi.fn();
        privateFn = vi.fn(() => ({ listen }));
        leave = vi.fn();
        (window as unknown as EchoWindow).Echo = { private: privateFn, leave };
    });

    afterEach(() => {
        delete (window as unknown as EchoWindow).Echo;
    });

    it('subscribes to the admin.tickets channel and listens for AdminTicketCreated', () => {
        const onNewTicket = vi.fn();

        renderHook(() => useAdminTicketsChannel(onNewTicket));

        expect(privateFn).toHaveBeenCalledTimes(1);
        expect(privateFn).toHaveBeenCalledWith('admin.tickets');
        expect(listen).toHaveBeenCalledTimes(1);
        expect(listen).toHaveBeenCalledWith('.AdminTicketCreated', expect.any(Function));
    });

    it('delivers the incoming payload to onNewTicket', () => {
        const onNewTicket = vi.fn();

        renderHook(() => useAdminTicketsChannel(onNewTicket));

        const registeredCallback = listen.mock.calls[0][1];
        const payload: Payload = { reference: 'TCK-000001', subject: 'Hi' };

        act(() => {
            registeredCallback(payload);
        });

        expect(onNewTicket).toHaveBeenCalledTimes(1);
        expect(onNewTicket).toHaveBeenCalledWith(payload);
    });

    it('is a no-op when window.Echo is not present', () => {
        delete (window as unknown as EchoWindow).Echo;
        const onNewTicket = vi.fn();

        expect(() => {
            const { unmount } = renderHook(() => useAdminTicketsChannel(onNewTicket));
            unmount();
        }).not.toThrow();

        expect(privateFn).not.toHaveBeenCalled();
        expect(listen).not.toHaveBeenCalled();
        expect(leave).not.toHaveBeenCalled();
    });

    it('leaves the admin.tickets channel on unmount', () => {
        const onNewTicket = vi.fn();

        const { unmount } = renderHook(() => useAdminTicketsChannel(onNewTicket));
        unmount();

        expect(leave).toHaveBeenCalledTimes(1);
        expect(leave).toHaveBeenCalledWith('admin.tickets');
    });

    it('re-subscribes when the onNewTicket callback identity changes', () => {
        const onNewTicketA = vi.fn();
        const onNewTicketB = vi.fn();

        const { rerender } = renderHook(({ cb }) => useAdminTicketsChannel(cb), {
            initialProps: { cb: onNewTicketA },
        });

        expect(privateFn).toHaveBeenCalledTimes(1);

        rerender({ cb: onNewTicketB });

        expect(leave).toHaveBeenCalledWith('admin.tickets');
        expect(privateFn).toHaveBeenCalledTimes(2);
        expect(listen).toHaveBeenCalledTimes(2);
        expect(listen).toHaveBeenLastCalledWith('.AdminTicketCreated', onNewTicketB);
    });
});
