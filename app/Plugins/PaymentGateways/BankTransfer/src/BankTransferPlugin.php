<?php

namespace App\Plugins\PaymentGateways;

use App\Contracts\PaymentGatewayPlugin;
use App\Contracts\SupportsOneTimePurchase;
use App\Helpers\CurrencyHelper;
use App\Models\CreditPack;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Transaction;
use App\Models\User;
use App\Notifications\AdminPaymentNotification;
use App\Notifications\BankTransferInstructionsNotification;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class BankTransferPlugin implements PaymentGatewayPlugin, SupportsOneTimePurchase
{
    private array $config;

    public function __construct(?array $config = null)
    {
        $this->config = $config ?? [];
    }

    /*
    |--------------------------------------------------------------------------
    | Base Plugin Methods
    |--------------------------------------------------------------------------
    */

    public function getName(): string
    {
        return 'Bank Transfer';
    }

    public function getDescription(): string
    {
        return 'Accept manual bank transfer payments with admin approval workflow';
    }

    public function getType(): string
    {
        return 'payment_gateway';
    }

    public function getIcon(): string
    {
        return 'Building2';
    }

    public function getVersion(): string
    {
        return '1.0.0';
    }

    public function getAuthor(): string
    {
        return 'Titan Systems';
    }

    public function getAuthorUrl(): string
    {
        return 'https://titansys.dev';
    }

    public function isConfigured(): bool
    {
        return ! empty($this->config['instructions']);
    }

    public function validateConfig(array $config): void
    {
        if (empty($config['instructions'])) {
            throw new \Exception('Bank transfer instructions are required');
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                'name' => 'instructions',
                'label' => 'Payment Instructions',
                'type' => 'textarea',
                'required' => true,
                'rows' => 10,
                'placeholder' => "Bank Name: Your Bank\nAccount Name: Your Company\nAccount Number: 1234567890\nRouting Number: 123456789\n\nPlease use your email address as the payment reference.",
                'help' => 'These instructions will be displayed to users when they select bank transfer. Include all necessary bank details and any reference requirements.',
            ],
            [
                'name' => 'confirmation_email',
                'label' => 'Send Confirmation Email',
                'type' => 'toggle',
                'default' => true,
                'help' => 'Send an email to the user with payment instructions after they initiate a bank transfer.',
            ],
            [
                'name' => 'admin_notification',
                'label' => 'Notify Admin',
                'type' => 'toggle',
                'default' => true,
                'help' => 'Send a notification to admins when a new bank transfer payment is initiated.',
            ],
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Payment Gateway Methods
    |--------------------------------------------------------------------------
    */

    public function initPayment(Plan $plan, User $user): RedirectResponse|string|array
    {
        // Check for existing pending subscription
        $existingPending = Subscription::where('user_id', $user->id)
            ->where('payment_method', Subscription::PAYMENT_BANK_TRANSFER)
            ->where('status', Subscription::STATUS_PENDING)
            ->first();

        if ($existingPending) {
            throw new \Exception('You already have a pending bank transfer. Please complete or cancel it first.');
        }

        $amount = round($plan->price, 2);
        $renewalAt = $this->calculateRenewalDate($plan);

        // Create subscription with pending status
        $subscription = Subscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'payment_method' => Subscription::PAYMENT_BANK_TRANSFER,
            'external_subscription_id' => 'BT-'.strtoupper(Str::random(10)),
            'status' => Subscription::STATUS_PENDING,
            'amount' => $amount,
            'renewal_at' => $renewalAt,
            'metadata' => [
                'instructions' => $this->config['instructions'] ?? null,
            ],
        ]);

        // Create pending transaction
        $transaction = Transaction::create([
            'user_id' => $user->id,
            'subscription_id' => $subscription->id,
            'amount' => $amount,
            'currency' => CurrencyHelper::getCode(),
            'status' => Transaction::STATUS_PENDING,
            'type' => Transaction::TYPE_SUBSCRIPTION_NEW,
            'payment_method' => Transaction::PAYMENT_BANK_TRANSFER,
            'transaction_date' => now(),
            'metadata' => [
                'bank_transfer_instructions' => $this->config['instructions'] ?? null,
            ],
        ]);

        // Send admin notification if configured
        if ($this->config['admin_notification'] ?? true) {
            AdminPaymentNotification::sendIfEnabled(
                'bank_transfer_pending',
                $user,
                $subscription,
                $transaction
            );
        }

        // Send confirmation email to user if configured
        if ($this->config['confirmation_email'] ?? true) {
            $user->notify(new BankTransferInstructionsNotification(
                $transaction,
                $this->config['instructions'] ?? ''
            ));
        }

        // Return bank transfer data for dialog display
        return [
            'type' => 'bank_transfer',
            'subscription_id' => $subscription->id,
            'reference' => $subscription->external_subscription_id,
            'amount' => $amount,
            'plan_name' => $plan->name,
            'instructions' => $this->config['instructions'] ?? '',
        ];
    }

    public function initOneTimePurchase(CreditPack $pack, User $user): RedirectResponse|string|array
    {
        $amount = round($pack->price, 2);

        // Guard against duplicate pending credit-pack purchases (e.g. double-submit).
        $existing = Transaction::where('user_id', $user->id)
            ->where('type', Transaction::TYPE_CREDIT_PURCHASE)
            ->where('status', Transaction::STATUS_PENDING)
            ->where('metadata->credit_pack_id', $pack->id)
            ->first();

        if ($existing) {
            return [
                'type' => 'bank_transfer',
                'reference' => $existing->transaction_id,
                'amount' => (float) $existing->amount,
                'currency' => $existing->currency,
                'pack_name' => $existing->metadata['pack_name'] ?? $pack->name,
                'instructions' => $this->config['instructions'] ?? '',
            ];
        }

        $transaction = Transaction::create([
            'user_id' => $user->id,
            'subscription_id' => null,
            'amount' => $amount,
            'currency' => $pack->currency,
            'status' => Transaction::STATUS_PENDING,
            'type' => Transaction::TYPE_CREDIT_PURCHASE,
            'payment_method' => Transaction::PAYMENT_BANK_TRANSFER,
            'transaction_date' => now(),
            'metadata' => [
                'credit_pack_id' => $pack->id,
                'pack_name' => $pack->name,
                'credits_granted' => $pack->getTotalCredits(),
            ],
        ]);

        if ($this->config['admin_notification'] ?? true) {
            AdminPaymentNotification::sendIfEnabled('bank_transfer_pending', $user, null, $transaction);
        }

        if ($this->config['confirmation_email'] ?? true) {
            $user->notify(new BankTransferInstructionsNotification(
                $transaction,
                $this->config['instructions'] ?? '',
                'credit_pack'
            ));
        }

        return [
            'type' => 'bank_transfer',
            'reference' => $transaction->transaction_id,
            'amount' => $amount,
            'currency' => $pack->currency,
            'pack_name' => $pack->name,
            'instructions' => $this->config['instructions'] ?? '',
        ];
    }

    public function handleWebhook(Request $request): Response
    {
        // Bank transfer doesn't use webhooks - all processing is manual
        return response('Bank Transfer does not use webhooks', 404);
    }

    public function callback(Request $request): RedirectResponse
    {
        // No callback for manual bank transfers
        return redirect()->route('create');
    }

    public function cancelSubscription(Subscription $subscription): void
    {
        // For bank transfer, just update the local subscription status
        $subscription->update([
            'status' => Subscription::STATUS_CANCELLED,
            'ends_at' => now(),
            'cancelled_at' => now(),
        ]);
    }

    public function getSubscriptionStatus(string $subscriptionId): array
    {
        // Bank transfer has no remote status - return local status
        $subscription = Subscription::where('external_subscription_id', $subscriptionId)->first();

        if (! $subscription) {
            throw new \Exception("Subscription not found: {$subscriptionId}");
        }

        return [
            'status' => $subscription->status,
            'renewal_at' => $subscription->renewal_at?->toISOString(),
            'amount' => $subscription->amount,
        ];
    }

    public function getSupportedCurrencies(): array
    {
        return []; // Supports all currencies
    }

    public function supportsAutoRenewal(): bool
    {
        return false;
    }

    public function requiresManualApproval(): bool
    {
        return true;
    }

    /*
    |--------------------------------------------------------------------------
    | Helper Methods
    |--------------------------------------------------------------------------
    */

    private function calculateRenewalDate(Plan $plan): Carbon
    {
        $billingPeriod = $plan->billing_period ?? 'monthly';

        return match ($billingPeriod) {
            'yearly' => now()->addYear(),
            'lifetime' => now()->addYears(100),
            default => now()->addMonth(),
        };
    }

    /**
     * Get the bank transfer instructions.
     */
    public function getInstructions(): ?string
    {
        return $this->config['instructions'] ?? null;
    }
}
