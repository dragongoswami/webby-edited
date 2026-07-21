<?php

namespace App\Services\Tickets;

use App\Events\Ticket\TicketReplied;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\User;
use App\Support\HtmlSanitizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

class TicketReplyService
{
    public function __construct(private TicketAttachmentService $attachments) {}

    /**
     * Post a reply on a ticket. Atomic: if the DB transaction rolls back,
     * any files written by the attachment service are deleted from disk.
     *
     * @param  array<int, UploadedFile>  $files
     */
    public function post(Ticket $ticket, User $author, string $body, array $files = [], bool $dispatchEvent = true): TicketMessage
    {
        $writtenPaths = [];
        $writtenDisk = 'local';

        try {
            return DB::transaction(function () use ($ticket, $author, $body, $files, $dispatchEvent, &$writtenPaths, &$writtenDisk) {
                $message = TicketMessage::create([
                    'ticket_id' => $ticket->id,
                    'user_id' => $author->id,
                    'body' => HtmlSanitizer::clean($body),
                ]);

                if (! empty($files)) {
                    $stored = $this->attachments->store($message, $files);
                    $writtenPaths = $stored['paths'];
                    $writtenDisk = $stored['disk'];
                    $message->load('attachments');
                }

                $ticket->status = $author->isAdmin() ? Ticket::STATUS_PENDING : Ticket::STATUS_OPEN;
                if ($ticket->closed_at) {
                    $ticket->closed_at = null;
                }
                $ticket->last_message_at = $message->created_at;
                $ticket->save();

                if ($dispatchEvent) {
                    TicketReplied::dispatch($ticket, $message);
                }

                return $message;
            });
        } catch (Throwable $e) {
            $this->attachments->deletePaths($writtenPaths, $writtenDisk);
            throw $e;
        }
    }
}
