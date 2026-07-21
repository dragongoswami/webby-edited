<?php

namespace App\Providers;

use App\Events\Builder\BuilderCompleteEvent;
use App\Events\Builder\BuilderErrorEvent;
use App\Events\Builder\BuilderStatusEvent;
use App\Events\Ticket\TicketClosed;
use App\Events\Ticket\TicketCreated;
use App\Events\Ticket\TicketReplied;
use App\Listeners\SyncProjectBuildStatus;
use App\Listeners\Ticket\SendTicketClosedNotification;
use App\Listeners\Ticket\SendTicketCreatedNotifications;
use App\Listeners\Ticket\SendTicketReplyNotifications;
use App\Listeners\TrackBuildCreditUsage;
use App\Models\Plan;
use App\Models\Plugin;
use App\Models\Project;
use App\Models\Subscription;
use App\Models\SystemSetting;
use App\Models\Ticket;
use App\Models\TicketMessage;
use App\Models\Transaction;
use App\Models\User;
use App\Observers\PlanObserver;
use App\Observers\PluginObserver;
use App\Observers\ProjectObserver;
use App\Observers\SubscriptionObserver;
use App\Observers\TicketMessageObserver;
use App\Observers\TicketObserver;
use App\Observers\TransactionObserver;
use App\Observers\UserObserver;
use App\Policies\TicketPolicy;
use App\Services\Storage\BucketStorageManager;
use App\Support\MailConfigurator;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Translation\FileLoader;
use Illuminate\Translation\Translator;
use Laravel\Sanctum\PersonalAccessToken;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Core service that routes project file-manager storage to the active
        // storage-provider plugin (or local). Singleton so per-request disk
        // registration and active-provider resolution are memoized.
        $this->app->singleton(BucketStorageManager::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // Cap default string length so varchar primary/unique keys stay under
        // MySQL's 1000-byte key limit on shared-hosting MyISAM / older InnoDB
        // (utf8mb4 × 255 = 1020 bytes would otherwise fail on fresh install).
        Schema::defaultStringLength(191);

        // Register custom JSON translation loader for lang/{locale}/*.json files
        $this->registerJsonTranslations();

        // Register model observers
        Plan::observe(PlanObserver::class);
        Plugin::observe(PluginObserver::class);
        Project::observe(ProjectObserver::class);
        Subscription::observe(SubscriptionObserver::class);
        Transaction::observe(TransactionObserver::class);
        User::observe(UserObserver::class);
        Ticket::observe(TicketObserver::class);
        TicketMessage::observe(TicketMessageObserver::class);

        // Register policies
        Gate::policy(Ticket::class, TicketPolicy::class);

        // Register event listeners (LogDemoRegistration is auto-discovered via type-hint)
        Event::listen(BuilderCompleteEvent::class, TrackBuildCreditUsage::class);
        Event::listen(BuilderCompleteEvent::class, [SyncProjectBuildStatus::class, 'handleComplete']);
        Event::listen(BuilderStatusEvent::class, SyncProjectBuildStatus::class);
        Event::listen(BuilderErrorEvent::class, [SyncProjectBuildStatus::class, 'handleError']);
        Event::listen(TicketCreated::class, SendTicketCreatedNotifications::class);
        Event::listen(TicketReplied::class, SendTicketReplyNotifications::class);
        Event::listen(TicketClosed::class, SendTicketClosedNotification::class);

        // Rate limiters
        RateLimiter::for('support-ticket-create', fn ($request) => [
            Limit::perHour(5)->by($request->user()?->id ?: $request->ip()),
        ]);
        RateLimiter::for('support-ticket-reply', fn ($request) => [
            Limit::perHour(30)->by($request->user()?->id ?: $request->ip()),
        ]);

        // User API: limit per personal access token (falls back to user/IP).
        RateLimiter::for('api-v1', function ($request) {
            $token = $request->user()?->currentAccessToken();
            $key = $token instanceof PersonalAccessToken
                ? 'pat:'.$token->id
                : ($request->user() ? 'user:'.$request->user()->id : 'ip:'.$request->ip());

            return [Limit::perMinute((int) config('api.rate_limit_per_minute', 60))->by($key)];
        });

        // Only configure dynamic settings if the database is available
        try {
            if (! Schema::hasTable('system_settings')) {
                return;
            }

            $this->configureSessionTimeout();
            $this->configureSessionDomain();
            $this->configureMailSettings();
            $this->configureSocialiteProviders();
        } catch (\Exception $e) {
            // Database not available yet (fresh install)
            return;
        }
    }

    /**
     * Apply dynamic session timeout from settings.
     */
    protected function configureSessionTimeout(): void
    {
        try {
            $timeout = SystemSetting::get('session_timeout', 120);
            config(['session.lifetime' => (int) $timeout]);
        } catch (\Exception $e) {
            // Ignore if settings table doesn't exist yet
        }
    }

    /**
     * Apply dynamic session cookie domain for cross-subdomain auth.
     * When subdomains are enabled, set cookie domain to .baseDomain
     * so auth works on dashboard.domain.com, app.domain.com, etc.
     */
    protected function configureSessionDomain(): void
    {
        try {
            if (SystemSetting::get('domain_enable_subdomains', false)) {
                $baseDomain = SystemSetting::get('domain_base_domain', '');
                if (! empty($baseDomain)) {
                    $domain = ltrim($baseDomain, '.');

                    // Only set the wildcard session domain when the request
                    // host actually matches the base domain. Otherwise the
                    // browser scopes the cookie to a domain that doesn't
                    // match the current host, causing 419 CSRF errors.
                    $host = request()->getHost();
                    if ($host === $domain || str_ends_with($host, ".{$domain}")) {
                        config(['session.domain' => ".{$domain}"]);
                    }
                }
            }
        } catch (\Exception $e) {
            // Ignore if settings table doesn't exist yet
        }
    }

    /**
     * Apply dynamic mail configuration from settings.
     */
    protected function configureMailSettings(): void
    {
        try {
            // Delegate to the shared configurator so the selected driver is
            // applied app-wide (not just for SMTP). See App\Support\MailConfigurator.
            MailConfigurator::apply();
        } catch (\Exception $e) {
            // Ignore if settings table doesn't exist yet
        }
    }

    /**
     * Configure Socialite providers from SystemSettings.
     */
    protected function configureSocialiteProviders(): void
    {
        try {
            $providers = ['google', 'facebook', 'github'];

            foreach ($providers as $provider) {
                $enabled = SystemSetting::get("{$provider}_login_enabled", false);

                if ($enabled) {
                    $clientId = SystemSetting::get("{$provider}_client_id", '');
                    $clientSecret = SystemSetting::get("{$provider}_client_secret", '');

                    if ($clientId && $clientSecret) {
                        config([
                            "services.{$provider}.client_id" => $clientId,
                            "services.{$provider}.client_secret" => $clientSecret,
                            "services.{$provider}.redirect" => url("/auth/{$provider}/callback"),
                        ]);
                    }
                }
            }
        } catch (\Exception $e) {
            // Ignore if settings table doesn't exist yet
        }
    }

    /**
     * Register JSON translations from lang/{locale}/*.json files.
     * Merges all JSON files in each locale directory into the translator.
     */
    protected function registerJsonTranslations(): void
    {
        $langPath = lang_path();

        // Override the translation loader to merge JSON files from locale subdirectories
        $this->app->extend('translation.loader', function ($loader, $app) use ($langPath) {
            return new class($app['files'], $langPath) extends FileLoader
            {
                protected string $langPath;

                public function __construct($files, $langPath)
                {
                    parent::__construct($files, $langPath);
                    $this->langPath = $langPath;
                }

                /**
                 * Load JSON translations, merging all JSON files from locale directories.
                 */
                public function load($locale, $group, $namespace = null)
                {
                    // For JSON translations (group is '*')
                    if ($group === '*' && $namespace === '*') {
                        return $this->loadMergedJsonPaths($locale);
                    }

                    return parent::load($locale, $group, $namespace);
                }

                /**
                 * Load JSON translations from locale directory, merging all JSON files.
                 */
                protected function loadMergedJsonPaths($locale): array
                {
                    $translations = [];

                    // First, load the default lang/{locale}.json if it exists
                    $defaultPath = "{$this->langPath}/{$locale}.json";
                    if ($this->files->exists($defaultPath)) {
                        $decoded = json_decode($this->files->get($defaultPath), true);
                        if (is_array($decoded)) {
                            $translations = array_merge($translations, $decoded);
                        }
                    }

                    // Then, load all JSON files from lang/{locale}/ directory
                    $directory = "{$this->langPath}/{$locale}";
                    if (is_dir($directory)) {
                        $files = glob("{$directory}/*.json");
                        foreach ($files as $file) {
                            $decoded = json_decode($this->files->get($file), true);
                            if (is_array($decoded)) {
                                $translations = array_merge($translations, $decoded);
                            }
                        }
                    }

                    return $translations;
                }
            };
        });
    }
}
