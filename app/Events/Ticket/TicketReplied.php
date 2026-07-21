<?php

namespace App\Events\Ticket;

use App\Models\Ticket;
use App\Models\TicketMessage;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TicketReplied
{
    use Dispatchable, SerializesModels;

    public function __construct(public Ticket $ticket, public TicketMessage $message)
    {
        // Don't serialize the computed body_preview into queue payloads — the
        // listener computes it from $message->body when it needs it.
        $this->message->makeHidden('body_preview');
    }
}
