<?php

namespace App\Notifications;

use App\Models\Ticket;
use App\Services\EmailThemeService;
use App\Traits\HandlesLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketClosedNotification extends Notification
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
                ->subject('['.$this->ticket->reference.'] '.__('Ticket closed: :subject', ['subject' => $this->ticket->subject]))
                ->view('mail.tickets.layout', array_merge($emailData, [
                    'subject' => '['.$this->ticket->reference.'] '.__('Ticket closed'),
                    'previewText' => __('Your support ticket has been closed.'),
                    'heading' => __('Your ticket has been closed'),
                    'intro' => __('We have closed this ticket. If you still need help, reply to reopen it.'),
                    'detailsTitle' => __('Ticket Details'),
                    'details' => [
                        __('Reference') => $this->ticket->reference,
                        __('Subject') => $this->ticket->subject,
                    ],
                    'actionText' => __('View ticket'),
                    'actionUrl' => url('/support/tickets/'.$this->ticket->reference),
                    'footer' => __('Thanks for using :app.', ['app' => $emailData['appName']]),
                ]));
        });
    }
}
