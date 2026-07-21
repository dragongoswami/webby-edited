<?php

namespace App\Listeners\Ticket;

use App\Events\Ticket\TicketReplied;
use App\Models\User;
use App\Notifications\TicketReplyNotification;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Notification;

class SendTicketReplyNotifications
{
    public function __construct(private NotificationService $notifications) {}

    public function handle(TicketReplied $event): void
    {
        $ticket = $event->ticket;
        $author = $event->message->user;

        if ($author?->isAdmin()) {
            if ($ticket->user) {
                $this->notifications->notify(
                    $ticket->user,
                    'ticket_replied',
                    __('New reply on your ticket'),
                    "[{$ticket->reference}] {$ticket->subject}",
                    ['ticket_id' => $ticket->id, 'reference' => $ticket->reference],
                    "/support/tickets/{$ticket->reference}"
                );
                $ticket->user->notify(new TicketReplyNotification($ticket, $event->message, forAdmin: false));
            }

            return;
        }

        $recipients = $ticket->assignedAdmin
            ? collect([$ticket->assignedAdmin])
            : User::where('role', 'admin')->get();

        foreach ($recipients as $admin) {
            $this->notifications->notify(
                $admin,
                'ticket_replied',
                __('User replied to a ticket'),
                "[{$ticket->reference}] {$ticket->subject}",
                ['ticket_id' => $ticket->id, 'reference' => $ticket->reference],
                "/admin/tickets/{$ticket->reference}"
            );
        }
        Notification::send($recipients, new TicketReplyNotification($ticket, $event->message, forAdmin: true));
    }
}
