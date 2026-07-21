<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ShopifyConnection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectShopifyController extends Controller
{
    /**
     * Attach, change, or detach the Shopify store a project auto-pushes to.
     * A null connection_id detaches. Changing the store also clears the stale
     * shopify_theme_id so the push job never tries to delete a prior theme on
     * the wrong store.
     */
    public function attach(Request $request, Project $project): JsonResponse
    {
        abort_unless($project->user_id === $request->user()->id, 403);
        abort_unless((bool) $request->user()->getCurrentPlan()?->shopifyConnectEnabled(), 403);
        abort_unless($project->isShopifyTheme(), 403);

        $data = $request->validate([
            'connection_id' => 'nullable|integer',
        ]);

        if (empty($data['connection_id'])) {
            $project->update(['shopify_connection_id' => null, 'shopify_theme_id' => null]);

            return response()->json(['ok' => true, 'shop_domain' => null]);
        }

        $conn = ShopifyConnection::where('id', $data['connection_id'])
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->firstOrFail();

        $update = ['shopify_connection_id' => $conn->id];
        if ($project->shopify_connection_id !== $conn->id) {
            $update['shopify_theme_id'] = null;
        }
        $project->update($update);

        return response()->json(['ok' => true, 'shop_domain' => $conn->shop_domain]);
    }
}
