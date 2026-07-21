<?php

namespace App\Contracts;

use App\Models\CreditPack;
use App\Models\User;
use Illuminate\Http\RedirectResponse;

/**
 * Opt-in capability for payment gateways that can process a one-time
 * (non-subscription) purchase, such as a credit pack top-up. Gateways that
 * implement this are offered in the "buy credits" UI; gateways that don't are
 * hidden from it. The base PaymentGatewayPlugin contract is unaffected.
 */
interface SupportsOneTimePurchase
{
    /**
     * Begin a one-time purchase of a credit pack. Returns a RedirectResponse,
     * a payment URL string, or a data array for inline display (bank transfer).
     * Implementations MUST create a Transaction of type
     * Transaction::TYPE_CREDIT_PURCHASE with metadata 'credit_pack_id',
     * 'pack_name', 'credits_granted', and MUST NOT grant credits themselves
     * (TransactionObserver grants on completion).
     * If a pending Transaction for the same user and pack already exists,
     * implementations SHOULD return a redirect/URL to the existing session
     * rather than creating a duplicate Transaction.
     */
    public function initOneTimePurchase(CreditPack $pack, User $user): RedirectResponse|string|array;
}
