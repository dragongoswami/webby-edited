<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopifyConnection;
use App\Services\ShopifyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopifyWebhookController extends Controller
{
    public function __construct(private ShopifyService $shopify) {}

    public function handle(Request $request): JsonResponse
    {
        if (! $this->shopify->verifyWebhook($request->getContent(), $request->header('X-Shopify-Hmac-Sha256'))) {
            return response()->json(['ok' => false], 403);
        }

        $topic = (string) $request->header('X-Shopify-Topic');
        $shop = (string) ($request->header('X-Shopify-Shop-Domain') ?: $request->input('myshopify_domain'));

        if ($topic === 'app/uninstalled' && $shop !== '') {
            ShopifyConnection::where('shop_domain', $shop)->update(['status' => 'revoked']);
        }

        // GDPR mandatory webhooks (customers/data_request, customers/redact,
        // shop/redact) are acknowledged — we store no Shopify customer PII.
        return response()->json(['ok' => true]);
    }
}
