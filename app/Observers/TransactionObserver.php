<?php

namespace App\Observers;

use App\Models\Transaction;
use App\Services\BuildCreditService;
use App\Services\NotificationService;
use App\Services\ReferralService;
use Illuminate\Support\Facades\DB;

class TransactionObserver
{
    public function __construct(
        protected ReferralService $referralService,
        protected NotificationService $notificationService,
        protected BuildCreditService $buildCreditService,
    ) {}

    /**
     * Handle the Transaction "updated" event.
     * Process referral commission when transaction becomes completed.
     */
    public function updated(Transaction $transaction): void
    {
        // Check if status was changed to completed
        if ($transaction->wasChanged('status') && $transaction->status === Transaction::STATUS_COMPLETED) {
            $this->referralService->processPaymentCommission($transaction);
            $this->notifyPaymentCompleted($transaction);
            $this->fulfillCreditPurchase($transaction);
        }

        // Check if status was changed to refunded
        if ($transaction->wasChanged('status') && $transaction->status === Transaction::STATUS_REFUNDED) {
            $this->referralService->processRefundClawback($transaction);
            $this->clawbackCreditPurchase($transaction);
        }
    }

    /**
     * Handle the Transaction "created" event.
     * Process referral commission if created with completed status.
     */
    public function created(Transaction $transaction): void
    {
        // If transaction is created already completed (e.g., instant payment)
        if ($transaction->status === Transaction::STATUS_COMPLETED) {
            $this->referralService->processPaymentCommission($transaction);
            $this->notifyPaymentCompleted($transaction);
            $this->fulfillCreditPurchase($transaction);
        }
    }

    protected function fulfillCreditPurchase(Transaction $transaction): void
    {
        if ($transaction->type !== Transaction::TYPE_CREDIT_PURCHASE) {
            return;
        }

        $user = DB::transaction(function () use ($transaction) {
            // Lock the row so the credited check-and-set is atomic across concurrent fires.
            $locked = Transaction::whereKey($transaction->getKey())->lockForUpdate()->first();
            if (! $locked) {
                return null;
            }

            $metadata = $locked->metadata ?? [];
            if (! empty($metadata['credited'])) {
                return null;
            }

            $credits = (int) ($metadata['credits_granted'] ?? 0);
            $user = $locked->user;
            if (! $user || $credits <= 0) {
                return null;
            }

            $user->addPurchasedCredits($credits);

            $metadata['credited'] = true;
            $locked->updateQuietly(['metadata' => $metadata]);

            return $user;
        });

        if ($user) {
            $this->buildCreditService->broadcastCreditsUpdated($user);
        }
    }

    protected function clawbackCreditPurchase(Transaction $transaction): void
    {
        if ($transaction->type !== Transaction::TYPE_CREDIT_PURCHASE) {
            return;
        }

        $user = DB::transaction(function () use ($transaction) {
            $locked = Transaction::whereKey($transaction->getKey())->lockForUpdate()->first();
            if (! $locked) {
                return null;
            }

            $metadata = $locked->metadata ?? [];
            if (empty($metadata['credited'])) {
                return null;
            }

            $credits = (int) ($metadata['credits_granted'] ?? 0);
            $user = $locked->user;
            if (! $user || $credits <= 0) {
                return null;
            }

            $user->clawbackPurchasedCredits($credits);

            $metadata['credited'] = false;
            $locked->updateQuietly(['metadata' => $metadata]);

            return $user;
        });

        if ($user) {
            $this->buildCreditService->broadcastCreditsUpdated($user);
        }
    }

    /**
     * Send payment completion notification to user.
     */
    protected function notifyPaymentCompleted(Transaction $transaction): void
    {
        if (! $transaction->user) {
            return;
        }

        $this->notificationService->notifyPaymentCompleted($transaction->user, $transaction);

        // Also notify about subscription renewal if this is a renewal transaction
        if ($transaction->type === Transaction::TYPE_SUBSCRIPTION_RENEWAL && $transaction->subscription) {
            $this->notificationService->notifySubscriptionRenewed($transaction->user, $transaction->subscription);
        }
    }
}
