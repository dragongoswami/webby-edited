<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GithubConnection;
use App\Models\Plugin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GithubWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $config = Plugin::where('slug', 'github')->first()?->config ?? [];
        $secret = $config['webhook_secret'] ?? null;
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), (string) $secret);
        $provided = (string) $request->header('X-Hub-Signature-256');

        if (! $secret || ! hash_equals($expected, $provided)) {
            return response()->json(['ok' => false], 403);
        }

        $action = $request->input('action');
        $installationId = $request->input('installation.id');

        if ($installationId && in_array($action, ['deleted', 'suspend'], true)) {
            GithubConnection::where('installation_id', $installationId)->update(['status' => 'revoked']);
        }

        return response()->json(['ok' => true]);
    }
}
