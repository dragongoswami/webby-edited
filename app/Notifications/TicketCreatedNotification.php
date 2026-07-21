<?php

namespace App\Notifications;

use App\Models\Ticket;
use App\Services\EmailThemeService;
use App\Traits\HandlesLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketCreatedNotification extends Notification
{
    use HandlesLocale, Queueable;

    public function __construct(public Ticket $ticket) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->withLocale($this->getNotifiableLocale($notifiable), function () {
            $emailData = EmailThemeService::getEmailData();

            return (new MailMessage)
                ->subject('['.$this->ticket->reference.'] '.__('New ticket: :subject', ['subject' => $this->ticket->subject]))
                ->view('mail.tickets.layout', array_merge($emailData, [
                    'subject' => '['.$this->ticket->reference.'] '.__('New support ticket'),
                    'previewText' => __('A new support ticket has been opened.'),
                    'heading' => __('New support ticket'),
                    'intro' => __('A user opened a new support ticket and is waiting for a reply.'),
                    'detailsTitle' => __('Ticket Details'),
                    'details' => [
                        __('Reference') => $this->ticket->reference,
                        __('From') => $this->ticket->user?->email ?? __('Deleted user'),
                        __('Subject') => $this->ticket->subject,
                    ],
                    'actionText' => __('View ticket'),
                    'actionUrl' => url('/admin/tickets/'.$this->ticket->reference),
                    'footer' => __('You received this email because you are an administrator.'),
                ]));
        });
    }
}
