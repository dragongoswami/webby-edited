<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\NotificationResource;
use App\Models\UserNotification;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NotificationsController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        // Floor of 1: per_page=0 would divide-by-zero in the paginator and
        // negatives would drop the LIMIT clause entirely.
        $perPage = max(1, min((int) $request->input('per_page', 20), 50));

        // The user's in-app notifications live in the custom UserNotification
        // model, not Laravel's Notifiable relation.
        $notifications = UserNotification::where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return NotificationResource::collection($notifications);
    }
}
