<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dedicated page for managing the user's BYOD Supabase connection library.
 * The connection CRUD/test itself lives in UserSupabaseConnectionController
 * (JSON); this just renders the management UI, gated by the plan capability.
 */
class DatabaseController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless((bool) $request->user()?->getCurrentPlan()?->databaseEnabled(), 403);

        return Inertia::render('Databases/Index');
    }
}
