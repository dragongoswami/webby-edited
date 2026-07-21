<?php

namespace App\Http\Controllers\Admin;

use App\Events\Ticket\TicketClosed;
use App\Http\Controllers\Controller;
use App\Http\Requests\Support\ReplyTicketRequest;
use App\Models\AuditLog;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Tickets\TicketReplyService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AdminTicketController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private TicketReplyService $reply) {}

    public function index(Request $request): Response
    {
        $q = Ticket::query()
            ->with([
                'user:id,name,email',
                'project:id,name',
                'assignedAdmin:id,name',
                // body itself is hidden from JSON output below — see ->each() near the return statement.
                // All columns must be fully qualified because latestOfMany() generates a self-join.
                'latestMessage' => fn ($q) => $q->select(
                    'ticket_messages.id',
                    'ticket_messages.ticket_id',
                    'ticket_messages.user_id',
                    'ticket_messages.body',
                    'ticket_messages.created_at',
                ),
            ])
            ->orderByDesc('last_message_at');

        $status = $request->query('status', 'all');
        if ($status && $status !== 'all') {
            $q->where('status', $status);
        }

        $assignee = $request->query('assignee', 'all');
        if ($assignee === 'me') {
            $q->where('assigned_admin_id', $request->user()->id);
        } elseif ($assignee === 'unassigned') {
            $q->whereNull('assigned_admin_id');
        } elseif (is_string($assignee) && ctype_digit($assignee)) {
            $q->where('assigned_admin_id', (int) $assignee);
        }

        $search = (string) $request->query('search', '');
        if ($search !== '') {
            $like = '%'.$search.'%';
            $q->where(function ($x) use ($like) {
                $x->where('reference', 'like', $like)
                    ->orWhere('subject', 'like', $like)
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'like', $like))
                    ->orWhereHas('messages', fn ($m) => $m->where('body', 'like', $like));
            });
        }

        $perPage = (int) $request->query('per_page', 20);
        if (! in_array($perPage, [10, 20, 30, 40, 50], true)) {
            $perPage = 20;
        }

        $tickets = $q->paginate($perPage)->withQueryString();
        $tickets->getCollection()->each(function ($ticket) {
            $ticket->latestMessage?->makeHidden('body');
        });

        return Inertia::render('Admin/Tickets/Index', [
            'tickets' => $tickets,
            'filters' => [
                'status' => $status,
                'assignee' => $assignee,
                'search' => $search,
            ],
            'admins' => User::where('role', 'admin')->select('id', 'name')->get(),
        ]);
    }

    public function show(Request $request, Ticket $ticket): Response
    {
        $this->authorize('view', $ticket);
        $ticket->load([
            'user:id,name,email,plan_id,created_at',
            'user.plan:id,name',
            'project:id,name',
            'assignedAdmin:id,name',
        ]);

        $perPage = (int) $request->query('per_page', 10);
        if (! in_array($perPage, [10, 20, 30, 40, 50], true)) {
            $perPage = 10;
        }

        $messages = $ticket->messages()
            ->with(['user:id,name,role,avatar', 'attachments'])
            ->orderBy('created_at')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Admin/Tickets/Show', [
            'ticket' => $ticket,
            'messages' => $messages,
            'admins' => User::where('role', 'admin')->select('id', 'name')->get(),
            'userStats' => [
                'ticketCount' => $ticket->user?->tickets()->count() ?? 0,
                'projectCount' => $ticket->user?->projects()->count() ?? 0,
            ],
        ]);
    }

    public function reply(ReplyTicketRequest $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('reply', $ticket);
        $this->reply->post($ticket, $request->user(), (string) $request->string('body'), $request->file('attachments', []) ?? []);
        $this->audit($request->user(), $ticket, 'reply');

        return back();
    }

    public function close(Request $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('close', $ticket);
        $ticket->update([
            'status' => Ticket::STATUS_CLOSED,
            'closed_at' => now(),
        ]);
        TicketClosed::dispatch($ticket);
        $this->audit($request->user(), $ticket, 'close');

        return back();
    }

    public function reopen(Request $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('close', $ticket);
        $ticket->update([
            'status' => Ticket::STATUS_OPEN,
            'closed_at' => null,
        ]);
        $this->audit($request->user(), $ticket, 'reopen');

        return back();
    }

    public function assign(Request $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('assign', $ticket);
        $data = $request->validate([
            'admin_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', 'admin')],
        ]);
        $ticket->update(['assigned_admin_id' => $data['admin_id'] ?? null]);
        $this->audit($request->user(), $ticket, 'assign', ['admin_id' => $data['admin_id'] ?? null]);

        return back();
    }

    private function audit(User $admin, Ticket $ticket, string $operation, array $extra = []): void
    {
        AuditLog::log(
            AuditLog::ACTION_ADMIN_ACTION,
            $ticket->user,
            $admin,
            Ticket::class,
            $ticket->id,
            null,
            null,
            array_merge(['operation' => "ticket.{$operation}", 'reference' => $ticket->reference], $extra)
        );
    }
}
