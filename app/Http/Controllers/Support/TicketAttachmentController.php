<?php

namespace App\Http\Controllers\Support;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketAttachment;
use App\Services\Storage\BucketStorageManager;
use App\Services\Tickets\TicketAttachmentService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TicketAttachmentController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private TicketAttachmentService $attachments) {}

    public function show(Ticket $ticket, TicketAttachment $attachment): RedirectResponse|StreamedResponse
    {
        $this->authorize('view', $ticket);
        abort_unless($attachment->message && $attachment->message->ticket_id === $ticket->id, 404);

        // Offload to the bucket via a presigned URL when the provider supports it.
        $url = app(BucketStorageManager::class)->temporaryUrlFor(
            $attachment->disk ?: 'local',
            $attachment->path,
            now()->addHour()
        );

        if ($url) {
            // no-store so the browser doesn't cache the 302 and follow a stale,
            // expired presigned URL after the short TTL elapses.
            return redirect()->away($url)->header('Cache-Control', 'no-store, private');
        }

        return $this->attachments->stream($attachment);
    }
}
