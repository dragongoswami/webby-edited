<?php

namespace Database\Seeders;

use App\Models\AiProvider;
use App\Models\Builder;
use App\Models\Plan;
use App\Models\Plugin;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\Template;
use App\Models\Transaction;
use App\Models\User;
use App\Plugins\BuilderCapabilities\GithubPlugin;
use App\Plugins\BuilderCapabilities\ShopifyPlugin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    /**
     * Build credits granted to newly registered demo accounts.
     *
     * Demo registrations are placed on the Pro plan, and UserObserver
     * provisions each new user with the plan's monthly build credits.
     */
    private const DEMO_BUILD_CREDITS = 1_500_000;

    /**
     * Seed demo mode configuration.
     *
     * Only runs when APP_ENV=local AND APP_DEMO=true.
     * Configures:
     * - Demo Ollama Cloud provider with minimax-m3 model
     * - Pusher broadcast settings
     * - System default AI provider and builder
     * - Default plan for new users (Pro)
     * - Internal AI provider with deepseek-v4-flash model
     * - All templates assigned to all plans
     * - Sentry error reporting enabled
     * - Referral system enabled
     * - Purchase code from APP_DEMO_CODE
     * - Demo transactions for admin user
     */
    public function run(): void
    {
        // Guard: Only run when APP_ENV=local AND APP_DEMO=true
        if (! config('app.demo')) {
            $this->command?->info('DemoSeeder: Skipped (not in demo mode)');

            return;
        }

        $this->command?->info('DemoSeeder: Configuring demo mode...');

        // 1. Create Demo AI Provider (Ollama Cloud)
        $aiProvider = $this->seedDemoAiProvider();

        // 2. Seed email settings
        $this->seedEmailSettings();

        // 3. Seed Pusher broadcast settings
        $this->seedBroadcastSettings();

        // 4. Set demo AI provider as system default
        $this->setDefaultAiProvider($aiProvider);

        // 5. Set default builder
        $this->setDefaultBuilder();

        // 6. Set default plan for new users to Pro
        $this->setDefaultPlan();

        // 7. Configure internal AI provider
        $this->seedInternalAiProvider($aiProvider);

        // 8. Assign all templates to all plans
        $this->assignTemplatesToPlans();

        // 9. Enable Sentry error reporting
        $this->enableSentry();

        // 10. Enable referral system
        $this->enableReferralSystem();

        // 11. Set purchase code from demo env
        $this->seedPurchaseCode();

        // 12. Create demo transactions for admin
        $this->seedDemoTransactions();

        // 13. Pre-install the Web Agent plugin and turn it on for the paid plans
        $this->seedWebAgentPlugin();

        // 14. Pre-install the WordPress plugin and turn it on for the paid plans
        $this->seedWordPressPlugin();

        // 15. Register the GitHub plugin: active + configured when demo GitHub
        // App credentials are provided via env, otherwise visible but disabled
        $this->seedGithubPlugin();

        // 16. Register the Shopify plugin: active + configured when demo Shopify
        // OAuth app credentials are provided via env, otherwise visible but disabled
        $this->seedShopifyPlugin();

        $this->command?->info('DemoSeeder: Demo mode configuration complete!');
    }

    /**
     * Create or update the demo Ollama Cloud provider.
     */
    private function seedDemoAiProvider(): AiProvider
    {
        $apiKey = config('demo.ai_key');

        if (empty($apiKey)) {
            $this->command?->warn('APP_DEMO_AI_KEY not set - AI provider will have empty credentials');
        }

        $provider = AiProvider::updateOrCreate(
            ['type' => AiProvider::TYPE_OLLAMA, 'name' => 'Demo Ollama Cloud'],
            [
                'credentials' => ['api_key' => $apiKey],
                'config' => [
                    'base_url' => AiProvider::DEFAULT_BASE_URLS[AiProvider::TYPE_OLLAMA],
                    'default_model' => 'minimax-m3',
                    'max_tokens' => 16384,
                    'summarizer_max_tokens' => 1000,
                ],
                'available_models' => AiProvider::DEFAULT_MODELS[AiProvider::TYPE_OLLAMA],
                'status' => 'active',
                'is_default' => false,
            ]
        );

        $this->command?->info("Created/updated Demo Ollama Cloud provider (ID: {$provider->id})");

        return $provider;
    }

    /**
     * Seed email settings from demo environment variables.
     */
    private function seedEmailSettings(): void
    {
        $settings = [
            'mail_mailer' => 'smtp',
            'smtp_host' => config('demo.smtp.host'),
            'smtp_port' => config('demo.smtp.port'),
            'smtp_username' => config('demo.smtp.username'),
            'smtp_password' => config('demo.smtp.password'),
            'smtp_encryption' => config('demo.smtp.encryption'),
            'mail_from_address' => config('demo.smtp.from_address'),
            'mail_from_name' => config('demo.smtp.from_name') ?: config('app.name', 'Webby'),
        ];

        if (empty($settings['smtp_host']) || $settings['smtp_host'] === 'smtp.example.com') {
            $this->command?->warn('Demo SMTP credentials not configured (using defaults)');
        }

        if (empty($settings['smtp_password'])) {
            unset($settings['smtp_password']);
        }

        SystemSetting::setMany($settings, 'email');
        $this->command?->info('Configured email settings');
    }

    /**
     * Seed Pusher broadcast settings from demo environment variables.
     */
    private function seedBroadcastSettings(): void
    {
        $settings = [
            'broadcast_driver' => 'pusher',
            'pusher_app_id' => config('demo.pusher.app_id'),
            'pusher_key' => config('demo.pusher.key'),
            'pusher_secret' => config('demo.pusher.secret'),
            'pusher_cluster' => config('demo.pusher.cluster'),
        ];

        if (empty($settings['pusher_app_id']) || empty($settings['pusher_key'])) {
            $this->command?->warn('Demo Pusher credentials not fully configured');
        }

        SystemSetting::setMany($settings, 'integrations');
        $this->command?->info('Configured Pusher broadcast settings');
    }

    /**
     * Set the demo AI provider as the system default.
     */
    private function setDefaultAiProvider(AiProvider $aiProvider): void
    {
        SystemSetting::set('default_ai_provider_id', $aiProvider->id, 'integer', 'plans');
        $this->command?->info("Set default AI provider: {$aiProvider->name} (ID: {$aiProvider->id})");
    }

    /**
     * Set the Local Builder as the system default builder.
     */
    private function setDefaultBuilder(): void
    {
        $builder = Builder::where('name', 'Local Builder')->first();

        if (! $builder) {
            $this->command?->warn('Local Builder not found - default builder not set');

            return;
        }

        SystemSetting::set('default_builder_id', $builder->id, 'integer', 'plans');
        $this->command?->info("Set default builder: {$builder->name} (ID: {$builder->id})");
    }

    /**
     * Set the default plan for new user registrations to Pro, grant it a
     * generous build credit allowance, and enable the BYOD database capability
     * and the read-only user API capability for the demo environment.
     */
    private function setDefaultPlan(): void
    {
        $proPlan = Plan::where('slug', 'pro')->first();

        if (! $proPlan) {
            $this->command?->warn('Pro plan not found - default plan not set');

            return;
        }

        SystemSetting::set('default_plan_id', $proPlan->id, 'integer', 'plans');

        // Give new demo registrations (placed on Pro, the default plan) a large
        // credit balance so visitors can freely explore the builder without
        // hitting credit limits.
        $proPlan->forceFill([
            'monthly_build_credits' => self::DEMO_BUILD_CREDITS,
        ])->save();

        // Turn on the BYOD database capability so demo users can link a Supabase
        // connection, and the read-only user API capability so they can explore
        // API access. Enabled on every paid plan so the higher tier never
        // appears to offer fewer capabilities than the lower one — PlanSeeder
        // uses firstOrCreate and won't re-assert these on an idempotent re-run.
        $this->enablePaidCapability('enable_database', 'Database (BYOD Supabase)');
        $this->enablePaidCapability('enable_api', 'read-only user API');

        // Refill the balance of users already on this plan. The admin user is
        // created by DatabaseSeeder *before* this seeder runs, so it was
        // provisioned with the plan's pre-bump allowance - without this its
        // balance would lag the limit (e.g. "500k / 1.5m").
        $refilled = User::where('plan_id', $proPlan->id)->update([
            'build_credits' => self::DEMO_BUILD_CREDITS,
            'credits_reset_at' => now(),
        ]);

        $this->command?->info("Set default plan for new users: {$proPlan->name} (ID: {$proPlan->id})");
        $this->command?->info('Set Pro plan demo build credits: '.number_format(self::DEMO_BUILD_CREDITS));
        $this->command?->info("Refilled build credits for {$refilled} existing Pro-plan user(s)");
    }

    /**
     * Flip a per-plan capability toggle on every paid plan (Pro + Enterprise)
     * so the demo's plan comparison stays consistent — a higher tier must never
     * appear to offer fewer capabilities than a lower one.
     */
    private function enablePaidCapability(string $flag, string $label): void
    {
        $plans = Plan::whereIn('slug', ['pro', 'enterprise'])->get();

        foreach ($plans as $plan) {
            $plan->forceFill([$flag => true])->save();
        }

        $this->command?->info("Enabled {$label} capability on the Pro and Enterprise plans");
    }

    /**
     * Configure the internal AI provider for landing page content generation.
     */
    private function seedInternalAiProvider(AiProvider $aiProvider): void
    {
        SystemSetting::set('internal_ai_provider_id', $aiProvider->id, 'integer', 'integrations');
        SystemSetting::set('internal_ai_model', 'deepseek-v4-flash', 'string', 'integrations');
        $this->command?->info('Configured internal AI provider with deepseek-v4-flash model');
    }

    /**
     * Assign all templates to all plans.
     */
    private function assignTemplatesToPlans(): void
    {
        $templateIds = Template::pluck('id')->toArray();
        $plans = Plan::all();

        if (empty($templateIds)) {
            $this->command?->warn('No templates found to assign');

            return;
        }

        if ($plans->isEmpty()) {
            $this->command?->warn('No plans found to assign templates to');

            return;
        }

        $plans->each(fn ($plan) => $plan->templates()->syncWithoutDetaching($templateIds));

        $this->command?->info(
            'Assigned '.count($templateIds).' templates to '.$plans->count().' plans'
        );
    }

    /**
     * Enable Sentry error reporting for demo mode.
     */
    private function enableSentry(): void
    {
        SystemSetting::set('sentry_enabled', true, 'boolean', 'general');
        $this->command?->info('Enabled Sentry error reporting');
    }

    /**
     * Enable the referral system for demo mode.
     */
    private function enableReferralSystem(): void
    {
        SystemSetting::set('referral_enabled', true, 'boolean', 'referral');
        $this->command?->info('Enabled referral system');
    }

    /**
     * Set the purchase code from the demo environment variable.
     */
    private function seedPurchaseCode(): void
    {
        $code = config('demo.code');

        if (empty($code)) {
            $this->command?->warn('APP_DEMO_CODE not set - purchase code not configured');

            return;
        }

        SystemSetting::set('purchase_code', $code, 'string', 'general');
        $this->command?->info('Configured purchase code from APP_DEMO_CODE');
    }

    /**
     * Register the Web Agent plugin as installed + active, and flip the
     * per-plan toggle on the paid plans so demo users get the capability
     * without needing to upload a release.zip.
     *
     * Source files already live at app/Plugins/BuilderCapabilities/WebAgent/
     * (canonical mirror), so the Plugin row is the only thing missing in a
     * fresh demo install.
     */
    private function seedWebAgentPlugin(): void
    {
        $manifestPath = app_path('Plugins/BuilderCapabilities/WebAgent/plugin.json');

        if (! file_exists($manifestPath)) {
            $this->command?->warn('Web Agent plugin manifest not found - skipping');

            return;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];

        Plugin::updateOrCreate(
            ['slug' => 'webagent'],
            [
                'name' => $manifest['name'] ?? 'Web Agent',
                'type' => $manifest['type'] ?? 'builder_capability',
                'class' => $manifest['namespace'] ?? 'App\\Plugins\\BuilderCapabilities\\WebAgentPlugin',
                'version' => $manifest['version'] ?? '1.0.0',
                'status' => 'active',
                'metadata' => $manifest,
                'installed_at' => now(),
            ]
        );

        $this->command?->info('Registered Web Agent plugin as active');

        $this->enablePaidCapability('enable_web_agent', 'Web Agent');
    }

    /**
     * Register the WordPress plugin as installed + active, and flip the
     * per-plan toggle on the paid plans so demo users can generate installable
     * WordPress block themes without needing to upload a release.zip.
     *
     * Source files already live at app/Plugins/BuilderCapabilities/WordPress/
     * (canonical mirror), so the Plugin row is the only thing missing in a
     * fresh demo install. Unlike GitHub, WordPress needs no external
     * credentials, so — like the Web Agent — it is safe to enable outright.
     */
    private function seedWordPressPlugin(): void
    {
        $manifestPath = app_path('Plugins/BuilderCapabilities/WordPress/plugin.json');

        if (! file_exists($manifestPath)) {
            $this->command?->warn('WordPress plugin manifest not found - skipping');

            return;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];

        Plugin::updateOrCreate(
            ['slug' => 'wordpress'],
            [
                'name' => $manifest['name'] ?? 'WordPress',
                'type' => $manifest['type'] ?? 'builder_capability',
                'class' => $manifest['namespace'] ?? 'App\\Plugins\\BuilderCapabilities\\WordPressPlugin',
                'version' => $manifest['version'] ?? '1.0.0',
                'status' => 'active',
                'metadata' => $manifest,
                'installed_at' => now(),
            ]
        );

        $this->command?->info('Registered WordPress plugin as active');

        $this->enablePaidCapability('enable_wordpress', 'WordPress');
    }

    /**
     * Register the GitHub plugin as installed so it is visible in the demo
     * (admin plugin list + as a sellable add-on).
     *
     * When demo GitHub App credentials are supplied via the APP_DEMO_GITHUB_*
     * env vars (config/demo.php), the plugin is activated with that config and
     * the capability is enabled on the paid plans — the connect flow then works
     * end-to-end against the operator's dedicated demo GitHub App. Without
     * credentials it stays DISABLED: status 'inactive', no plan toggle, no
     * config — an active row would only surface a broken connect flow.
     *
     * Source files live at app/Plugins/BuilderCapabilities/Github/ (canonical
     * mirror), so the Plugin row is the only thing missing in a fresh demo.
     */
    private function seedGithubPlugin(): void
    {
        $manifestPath = app_path('Plugins/BuilderCapabilities/Github/plugin.json');

        if (! file_exists($manifestPath)) {
            $this->command?->warn('GitHub plugin manifest not found - skipping');

            return;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];
        $config = $this->demoGithubConfig();

        Plugin::updateOrCreate(
            ['slug' => 'github'],
            [
                'name' => $manifest['name'] ?? 'GitHub',
                'type' => $manifest['type'] ?? 'builder_capability',
                'class' => $manifest['namespace'] ?? 'App\\Plugins\\BuilderCapabilities\\GithubPlugin',
                'version' => $manifest['version'] ?? '1.0.0',
                'status' => $config ? 'active' : 'inactive',
                'config' => $config,
                'metadata' => $manifest,
                'installed_at' => now(),
            ]
        );

        if (! $config) {
            $this->command?->info('Registered GitHub plugin (disabled) for demo - APP_DEMO_GITHUB_* credentials not set');

            return;
        }

        $this->command?->info('Registered GitHub plugin as active with demo GitHub App credentials');

        $this->enablePaidCapability('enable_github', 'GitHub');
    }

    /**
     * Build the GitHub plugin config from the APP_DEMO_GITHUB_* env vars.
     *
     * Returns null unless every required credential is present and valid
     * (so a partial paste seeds the safe inactive state instead of a broken
     * active plugin). The private key arrives base64-encoded because .env
     * values are single-line; a raw PEM paste is tolerated as a fallback.
     */
    private function demoGithubConfig(): ?array
    {
        $privateKey = (string) config('demo.github.private_key');

        if ($privateKey !== '' && ! str_contains($privateKey, 'PRIVATE KEY')) {
            $decoded = base64_decode($privateKey, true);
            $privateKey = $decoded !== false ? $decoded : $privateKey;
        }

        $config = [
            'app_id' => (string) config('demo.github.app_id'),
            'app_slug' => (string) config('demo.github.app_slug'),
            'private_key' => $privateKey,
            'client_id' => (string) config('demo.github.client_id'),
            'client_secret' => (string) config('demo.github.client_secret'),
            'webhook_secret' => (string) config('demo.github.webhook_secret'),
        ];

        if (empty($config['app_id']) && empty($config['client_id']) && $privateKey === '') {
            return null; // Not configured at all — the common case, no warning needed.
        }

        try {
            (new GithubPlugin)->validateConfig($config);
        } catch (\InvalidArgumentException $e) {
            $this->command?->warn("Demo GitHub credentials incomplete ({$e->getMessage()}) - GitHub plugin left disabled");

            return null;
        }

        if (empty($config['client_secret'])) {
            $this->command?->warn('APP_DEMO_GITHUB_CLIENT_SECRET not set - GitHub plugin left disabled');

            return null;
        }

        return $config;
    }

    private function seedShopifyPlugin(): void
    {
        $manifestPath = app_path('Plugins/BuilderCapabilities/Shopify/plugin.json');

        if (! file_exists($manifestPath)) {
            $this->command?->warn('Shopify plugin manifest not found - skipping');

            return;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];
        $config = $this->demoShopifyConfig();

        Plugin::updateOrCreate(
            ['slug' => 'shopify'],
            [
                'name' => $manifest['name'] ?? 'Shopify',
                'type' => $manifest['type'] ?? 'builder_capability',
                'class' => $manifest['namespace'] ?? 'App\\Plugins\\BuilderCapabilities\\ShopifyPlugin',
                'version' => $manifest['version'] ?? '1.0.0',
                'status' => $config ? 'active' : 'inactive',
                'config' => $config,
                'metadata' => $manifest,
                'installed_at' => now(),
            ]
        );

        if (! $config) {
            $this->command?->info('Registered Shopify plugin (disabled) for demo - APP_DEMO_SHOPIFY_* credentials not set');

            return;
        }

        $this->command?->info('Registered Shopify plugin as active with demo Shopify app credentials');

        $this->enablePaidCapability('enable_shopify', 'Shopify');
    }

    /**
     * Build the Shopify plugin config from the APP_DEMO_SHOPIFY_* env vars.
     *
     * Returns null unless every required credential (api_key, api_secret,
     * webhook_secret) is present, so a partial paste seeds the safe inactive
     * state instead of a broken active plugin.
     */
    private function demoShopifyConfig(): ?array
    {
        $config = [
            // The demo ships full BYOS, so store connections are enabled (this
            // also makes validateConfig() below enforce credential completeness).
            'enable_store_connections' => true,
            'shopify_api_key' => (string) config('demo.shopify.api_key'),
            'shopify_api_secret' => (string) config('demo.shopify.api_secret'),
            'webhook_secret' => (string) config('demo.shopify.webhook_secret'),
        ];

        if (empty($config['shopify_api_key']) && empty($config['shopify_api_secret']) && empty($config['webhook_secret'])) {
            return null; // Not configured at all — the common case, no warning needed.
        }

        try {
            (new ShopifyPlugin)->validateConfig($config);
        } catch (\InvalidArgumentException $e) {
            $this->command?->warn("Demo Shopify credentials incomplete ({$e->getMessage()}) - Shopify plugin left disabled");

            return null;
        }

        return $config;
    }

    /**
     * Create demo transactions for the admin user.
     */
    private function seedDemoTransactions(): void
    {
        $admin = User::where('email', 'admin@webby.com')->first();

        if (! $admin) {
            $this->command?->warn('Admin user not found - demo transactions not created');

            return;
        }

        $subscription = Subscription::where('user_id', $admin->id)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->first();

        if (! $subscription) {
            $this->command?->warn('Admin subscription not found - demo transactions not created');

            return;
        }

        $currency = SystemSetting::get('default_currency', 'USD');

        // Sample transactions with different dates and types.
        // transaction_id is generated inline because withoutEvents() below
        // skips the model's creating hook that normally sets it.
        $transactions = [
            [
                'transaction_id' => 'TRX-'.strtoupper(Str::random(8)),
                'user_id' => $admin->id,
                'subscription_id' => $subscription->id,
                'amount' => 29.00,
                'currency' => $currency,
                'status' => Transaction::STATUS_COMPLETED,
                'type' => Transaction::TYPE_SUBSCRIPTION_NEW,
                'payment_method' => 'stripe',
                'transaction_date' => now()->subMonths(3),
                'external_transaction_id' => 'pi_demo_'.uniqid(),
                'notes' => 'Initial Pro plan subscription',
            ],
            [
                'transaction_id' => 'TRX-'.strtoupper(Str::random(8)),
                'user_id' => $admin->id,
                'subscription_id' => $subscription->id,
                'amount' => 29.00,
                'currency' => $currency,
                'status' => Transaction::STATUS_COMPLETED,
                'type' => Transaction::TYPE_SUBSCRIPTION_RENEWAL,
                'payment_method' => 'stripe',
                'transaction_date' => now()->subMonths(2),
                'external_transaction_id' => 'pi_demo_'.uniqid(),
                'notes' => 'Monthly renewal',
            ],
            [
                'transaction_id' => 'TRX-'.strtoupper(Str::random(8)),
                'user_id' => $admin->id,
                'subscription_id' => $subscription->id,
                'amount' => 29.00,
                'currency' => $currency,
                'status' => Transaction::STATUS_COMPLETED,
                'type' => Transaction::TYPE_SUBSCRIPTION_RENEWAL,
                'payment_method' => 'stripe',
                'transaction_date' => now()->subMonth(),
                'external_transaction_id' => 'pi_demo_'.uniqid(),
                'notes' => 'Monthly renewal',
            ],
            [
                'transaction_id' => 'TRX-'.strtoupper(Str::random(8)),
                'user_id' => $admin->id,
                'subscription_id' => $subscription->id,
                'amount' => 29.00,
                'currency' => $currency,
                'status' => Transaction::STATUS_COMPLETED,
                'type' => Transaction::TYPE_SUBSCRIPTION_RENEWAL,
                'payment_method' => 'stripe',
                'transaction_date' => now()->subDays(5),
                'external_transaction_id' => 'pi_demo_'.uniqid(),
                'notes' => 'Monthly renewal',
            ],
        ];

        $created = 0;

        // Disable model events to avoid broadcasting notifications
        // (broadcast config may not match DB settings during seeding)
        Transaction::withoutEvents(function () use ($transactions, &$created) {
            foreach ($transactions as $txnData) {
                // Use firstOrCreate to avoid duplicates on re-run
                $existing = Transaction::where('user_id', $txnData['user_id'])
                    ->where('type', $txnData['type'])
                    ->whereDate('transaction_date', $txnData['transaction_date'])
                    ->first();

                if (! $existing) {
                    Transaction::create($txnData);
                    $created++;
                }
            }
        });

        $this->command?->info("Created {$created} demo transactions for admin user");
    }
}
