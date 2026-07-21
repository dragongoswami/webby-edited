<?php

namespace App\Observers;

use App\Models\TicketMessage;
use Illuminate\Support\Facades\DB;

/**
 * Updates the parent ticket's last_message_at when a message is created
 * outside the normal TicketReplyService flow (e.g. via factory in tests).
 *
 * Defers via DB::afterCommit so it never persists a partial update if the
 * surrounding transaction rolls back. The TicketReplyService updates
 * last_message_at directly inside its transaction, so this observer is
 * a safety net for paths that bypass the service.
 */
class TicketMessageObserver
{
    public function created(TicketMessage $message): void
    {
        $ticket = $message->ticket;
        if (! $ticket) {
            return;
        }

        if ($ticket->last_message_at && $message->created_at
            && $ticket->last_message_at->equalTo($message->created_at)) {
            return;
        }

        $createdAt = $message->created_at;
        DB::afterCommit(function () use ($ticket, $createdAt) {
            $ticket->forceFill([
                'last_message_at' => $createdAt ?? now(),
            ])->save();
        });
    }
}
