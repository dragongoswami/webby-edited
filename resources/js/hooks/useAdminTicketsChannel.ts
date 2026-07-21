import { useEffect } from 'react';

type Payload = { reference: string; subject: string };
type EchoWindow = Window & {
    Echo?: {
        private: (channel: string) => {
            listen: (event: string, cb: (payload: Payload) => void) => void;
        };
        leave: (channel: string) => void;
    };
};

export function useAdminTicketsChannel(onNewTicket: (payload: Payload) => void) {
    useEffect(() => {
        const w = window as unknown as EchoWindow;
        if (!w.Echo) return;

        w.Echo.private('admin.tickets').listen('.AdminTicketCreated', onNewTicket);

        return () => {
            w.Echo?.leave('admin.tickets');
        };
    }, [onNewTicket]);
}
