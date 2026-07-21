<?php

namespace App\Http\Controllers;

use App\Contracts\SupportsOneTimePurchase;
use App\Http\Traits\ChecksDemoMode;
use App\Models\CreditPack;
use App\Services\PluginManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class CreditPackPurchaseController extends Controller
{
    use ChecksDemoMode;

    public function __construct(private PluginManager $pluginManager) {}

    public function initiate(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'credit_pack_id' => 'required|exists:credit_packs,id',
            'gateway' => 'required|string',
        ]);

        $user = $request->user();
        $pack = CreditPack::findOrFail($validated['credit_pack_id']);

        if (! $pack->is_active) {
            return back()->withErrors(['credit_pack_id' => __('This credit pack is not available.')]);
        }

        if ($user->hasUnlimitedCredits() || $user->isUsingOwnAiApiKey()) {
            return back()->withErrors(['credit_pack_id' => __('Credit packs are not applicable to your plan.')]);
        }

        if (! $pack->isAvailableToPlan($user->getCurrentPlan())) {
            return back()->withErrors(['credit_pack_id' => __('This credit pack is not available on your plan.')]);
        }

        $gateway = $this->pluginManager->getGatewayBySlug($validated['gateway']);

        if (! $gateway || ! ($gateway instanceof SupportsOneTimePurchase)) {
            return back()->withErrors(['gateway' => __('This payment method cannot be used for credit packs.')]);
        }

        $supported = $gateway->getSupportedCurrencies();
        if (! empty($supported) && ! in_array($pack->currency, $supported)) {
            return back()->withErrors(['gateway' => __('This payment method does not support :currency.', ['currency' => $pack->currency])]);
        }

        try {
            $result = $gateway->initOneTimePurchase($pack, $user);
        } catch (\Exception $e) {
            Log::error('Credit pack purchase failed: '.$e->getMessage(), [
                'user_id' => $user->id, 'credit_pack_id' => $pack->id, 'gateway' => $validated['gateway'], 'exception' => $e,
            ]);

            return back()->withErrors(['payment' => __('Payment initialization failed. Please try again or contact support.')]);
        }

        if (is_array($result)) {
            return back()->with('bankTransfer', $result);
        }

        if (is_string($result)) {
            return Inertia::location($result);
        }

        return $result;
    }
}
