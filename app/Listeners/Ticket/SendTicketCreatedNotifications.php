<?php

namespace App\Listeners\Ticket;

use App\Events\Ticket\AdminTicketCreated;
use App\Events\Ticket\TicketCreated;
use App\Models\SystemSetting;
use App\Models\User;
use App\Notifications\TicketCreatedNotification;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Notification;

class SendTicketCreatedNotifications
{
    public function __construct(private NotificationService $notifications) {}

    public function handle(TicketCreated $event): void
    {
        $ticket = $event->ticket;
        $admins = User::where('role', 'admin')->get();

        foreach ($admins as $admin) {
            $this->notifications->notify(
                $admin,
                'ticket_created',
                __('New support ticket'),
                "[{$ticket->reference}] {$ticket->subject}",
                ['ticket_id' => $ticket->id, 'reference' => $ticket->reference, 'subject' => $ticket->subject],
                "/admin/tickets/{$ticket->reference}"
            );
        }

        $override = SystemSetting::get('support.notify_admin_emails', []);
        if (is_array($override) && ! empty($override)) {
            Notification::route('mail', $override)->notify(new TicketCreatedNotification($ticket));
        } else {
            Notification::send($admins, new TicketCreatedNotification($ticket));
        }

        AdminTicketCreated::dispatch($ticket);
    }
}
