<?php

namespace App\Notifications;

use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Services\EmailThemeService;
use App\Traits\HandlesLocale;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketReplyNotification extends Notification
{
    use HandlesLocale, Queueable;

    public function __construct(
        public Ticket $ticket,
        public TicketMessage $message,
        public bool $forAdmin,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return $this->withLocale($this->getNotifiableLocale($notifiable), function () {
            $emailData = EmailThemeService::getEmailData();
            $base = $this->forAdmin ? '/admin/tickets' : '/support/tickets';
            $author = $this->message->user?->name ?? __('Support');

            return (new MailMessage)
                ->subject('['.$this->ticket->reference.'] '.$this->ticket->subject)
                ->view('mail.tickets.layout', array_merge($emailData, [
                    'subject' => '['.$this->ticket->reference.'] '.$this->ticket->subject,
                    'previewText' => __('New reply from :author', ['author' => $author]),
                    'heading' => __('New reply from :author', ['author' => $author]),
                    'intro' => __('On ticket :ref - :subject', [
                        'ref' => $this->ticket->reference,
                        'subject' => $this->ticket->subject,
                    ]),
                    'bodyHtml' => $this->message->body,
                    'attachments' => $this->message->attachments->pluck('original_name')->all(),
                    'actionText' => __('View ticket'),
                    'actionUrl' => url($base.'/'.$this->ticket->reference),
                ]));
        });
    }
}
