<?php

namespace App\Http\Controllers\Support;

use App\Events\Ticket\TicketCreated;
use App\Exceptions\OpenTicketLimitReachedException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Support\ReplyTicketRequest;
use App\Http\Requests\Support\StoreTicketRequest;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Tickets\TicketReplyService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SupportTicketController extends Controller
{
    use AuthorizesRequests;

    public function __construct(private TicketReplyService $reply) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $status = $request->query('status', 'all');

        $perPage = (int) $request->query('per_page', 10);
        if (! in_array($perPage, [10, 20, 30, 40, 50], true)) {
            $perPage = 10;
        }

        $tickets = $user->tickets()
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->with(['latestMessage' => fn ($q) => $q->select(
                'ticket_messages.id',
                'ticket_messages.ticket_id',
                'ticket_messages.user_id',
                'ticket_messages.body',
                'ticket_messages.created_at',
            )])
            ->orderByDesc('last_message_at')
            ->paginate($perPage)
            ->withQueryString();

        // body is needed to compute body_preview on the model, but the raw
        // HTML body itself doesn't need to ship to the inbox list — hide it
        // from JSON serialization so we don't push hundreds of KB per row.
        $tickets->getCollection()->each(function ($ticket) {
            $ticket->latestMessage?->makeHidden('body');
        });

        return Inertia::render('Support/Index', [
            'tickets' => $tickets,
            'filter' => $status,
            'planEnabled' => (bool) ($user->plan?->enable_support_tickets),
            'openLimit' => $user->plan?->max_open_tickets_per_user,
            'openCount' => $user->tickets()->whereIn('status', [Ticket::STATUS_OPEN, Ticket::STATUS_PENDING])->count(),
            'projects' => $user->projects()->select('id', 'name')->orderBy('name')->get(),
        ]);
    }

    public function store(StoreTicketRequest $request): RedirectResponse
    {
        $user = $request->user();

        try {
            $ticket = DB::transaction(function () use ($request, $user) {
                // Serialise concurrent submits for the same user so the open
                // ticket limit can't be raced. Locking the user row covers
                // even the first-ticket case (no prior rows to lock).
                //
                // NOTE: SQLite does not implement SELECT … FOR UPDATE and
                // silently drops the lock clause, so this guarantee is only
                // enforced on MySQL/Postgres. On SQLite a worst-case race
                // can let two concurrent submits both pass the check; the
                // route's 5/hour rate limit caps the practical blast radius.
                $locked = User::query()->whereKey($user->id)->lockForUpdate()->first();
                $limit = $locked?->plan?->max_open_tickets_per_user;
                $open = $locked
                    ?->tickets()
                    ->whereIn('status', [Ticket::STATUS_OPEN, Ticket::STATUS_PENDING])
                    ->count();

                if ($limit !== null && $open >= $limit) {
                    throw new OpenTicketLimitReachedException;
                }

                $ticket = Ticket::create([
                    'user_id' => $user->id,
                    'project_id' => $request->input('project_id'),
                    'subject' => (string) $request->string('subject'),
                    'status' => Ticket::STATUS_OPEN,
                ]);

                // Suppress the TicketReplied event for the first message — the
                // TicketCreated event below is what notifies admins. Without this
                // suppression admins would receive both notifications for the same
                // user action.
                $this->reply->post(
                    $ticket,
                    $user,
                    (string) $request->string('body'),
                    $request->file('attachments', []) ?? [],
                    dispatchEvent: false,
                );

                return $ticket;
            });
        } catch (OpenTicketLimitReachedException) {
            return back()->withErrors(['subject' => __('Open ticket limit reached.')]);
        }

        TicketCreated::dispatch($ticket);

        return redirect()->route('support.tickets.show', $ticket->reference);
    }

    public function show(Request $request, Ticket $ticket): Response
    {
        $this->authorize('view', $ticket);
        $ticket->load('project:id,name');

        $perPage = (int) $request->query('per_page', 10);
        if (! in_array($perPage, [10, 20, 30, 40, 50], true)) {
            $perPage = 10;
        }

        $messages = $ticket->messages()
            ->with(['user:id,name,role,avatar', 'attachments'])
            ->orderBy('created_at')
            ->paginate($perPage)
            ->withQueryString();

        return Inertia::render('Support/Show', [
            'ticket' => $ticket,
            'messages' => $messages,
            'canReply' => $request->user()->can('reply', $ticket),
        ]);
    }

    public function reply(ReplyTicketRequest $request, Ticket $ticket): RedirectResponse
    {
        $this->authorize('reply', $ticket);

        if (! $request->user()->plan?->enable_support_tickets) {
            abort(403, __('Support tickets are not enabled on your plan.'));
        }

        $this->reply->post($ticket, $request->user(), (string) $request->string('body'), $request->file('attachments', []) ?? []);

        return redirect()->route('support.tickets.show', $ticket->reference);
    }
}
