<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dedicated page for managing the user's GitHub connection library. The
 * connection list/destroy + OAuth connect/callback live in
 * UserGithubConnectionController (JSON); this just renders the gated UI.
 * Mirrors DatabaseController.
 */
class GithubController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless((bool) $request->user()?->getCurrentPlan()?->githubEnabled(), 403);

        return Inertia::render('Github/Index');
    }
}
