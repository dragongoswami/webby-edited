<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\QueryException;

class CreditPackPurchaseService
{
    /**
     * Record a completed one-time credit-pack purchase as an idempotent
     * Transaction. The TransactionObserver grants the purchased credits on
     * creation (status completed + type credit_purchase). Safe to call more
     * than once for the same external transaction id (webhook replay).
     *
     * @param  array{id:int|string, name:string, credits_granted:int}  $pack
     * @param  float  $amount  Amount in the display currency unit (e.g. 19.99, not minor units).
     */
    public function recordCompletedPurchase(
        User $user,
        array $pack,
        string $externalTransactionId,
        float $amount,
        string $currency,
        string $paymentMethod,
    ): Transaction {
        if ((int) ($pack['credits_granted'] ?? 0) <= 0) {
            throw new \InvalidArgumentException('credits_granted must be a positive integer; got: '.var_export($pack['credits_granted'] ?? null, true));
        }

        try {
            return Transaction::firstOrCreate(
                ['external_transaction_id' => $externalTransactionId],
                [
                    'user_id' => $user->id,
                    'subscription_id' => null,
                    'amount' => round($amount, 2),
                    'currency' => $currency,
                    'status' => Transaction::STATUS_COMPLETED,
                    'type' => Transaction::TYPE_CREDIT_PURCHASE,
                    'payment_method' => $paymentMethod,
                    'transaction_date' => now(),
                    'metadata' => [
                        'credit_pack_id' => $pack['id'],
                        'pack_name' => $pack['name'],
                        'credits_granted' => (int) $pack['credits_granted'],
                    ],
                ]
            );
        } catch (QueryException $e) {
            // A concurrent webhook won the insert race; return the existing row (credits granted once).
            $existing = Transaction::where('external_transaction_id', $externalTransactionId)->first();
            if ($existing) {
                return $existing;
            }
            throw $e;
        }
    }
}
