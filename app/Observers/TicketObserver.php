<?php

namespace App\Observers;

use App\Models\Ticket;

class TicketObserver
{
    public function creating(Ticket $ticket): void
    {
        if (! $ticket->reference) {
            $ticket->reference = Ticket::generateReference();
        }
        if (! $ticket->last_message_at) {
            $ticket->last_message_at = now();
        }
    }
}
