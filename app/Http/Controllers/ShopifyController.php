<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dedicated page for managing the user's Shopify connection library. The
 * connection list/destroy + OAuth connect/callback live in
 * UserShopifyConnectionController (JSON); this just renders the gated UI.
 * Mirrors GithubController.
 */
class ShopifyController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless((bool) $request->user()?->getCurrentPlan()?->shopifyConnectEnabled(), 403);

        return Inertia::render('Shopify/Index');
    }
}
