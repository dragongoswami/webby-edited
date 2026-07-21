<?php

namespace App\Events\Ticket;

use App\Models\Ticket;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AdminTicketCreated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Ticket $ticket) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin.tickets')];
    }

    public function broadcastAs(): string
    {
        return 'AdminTicketCreated';
    }

    public function broadcastWith(): array
    {
        return [
            'reference' => $this->ticket->reference,
            'subject' => $this->ticket->subject,
        ];
    }
}
