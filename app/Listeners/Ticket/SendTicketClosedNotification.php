<?php

namespace App\Listeners\Ticket;

use App\Events\Ticket\TicketClosed;
use App\Notifications\TicketClosedNotification;
use App\Services\NotificationService;

class SendTicketClosedNotification
{
    public function __construct(private NotificationService $notifications) {}

    public function handle(TicketClosed $event): void
    {
        $ticket = $event->ticket;
        if (! $ticket->user) {
            return;
        }

        $this->notifications->notify(
            $ticket->user,
            'ticket_closed',
            __('Ticket closed'),
            "[{$ticket->reference}] {$ticket->subject}",
            ['ticket_id' => $ticket->id, 'reference' => $ticket->reference],
            "/support/tickets/{$ticket->reference}"
        );
        $ticket->user->notify(new TicketClosedNotification($ticket));
    }
}
