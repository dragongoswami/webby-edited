<?php

namespace App\Http\Controllers\Admin;

use App\Helpers\CurrencyHelper;
use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Jobs\ApplyUpdateJob;
use App\Models\AiProvider;
use App\Models\Builder;
use App\Models\CreditPack;
use App\Models\Language;
use App\Models\Plan;
use App\Models\SystemSetting;
use App\Services\BroadcastService;
use App\Services\BuilderUpdateService;
use App\Services\DomainSettingService;
use App\Services\InternalAiService;
use App\Services\PluginManager;
use App\Services\UpdateService;
use App\Support\CustomDomainHelper;
use App\Support\MailConfigurator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Pusher\Pusher;

class SettingsController extends Controller
{
    use ChecksDemoMode;

    /**
     * Display settings page with all groups.
     */
    public function index(Request $request)
    {
        return Inertia::render('Admin/Settings', [
            'settings' => [
                'general' => $this->getGeneralSettings(),
                'plans' => $this->getPlansSettings(),
                'referral' => $this->getReferralSettings(),
                'domains' => $this->getDomainSettings(),
                'auth' => $this->getAuthSettings(),
                'email' => $this->getEmailSettings(),
                'gdpr' => $this->getGdprSettings(),
                'integrations' => $this->getIntegrationSettings(),
                'updates' => $this->getUpdatesSettings(),
            ],
            'plans' => Plan::where('is_active', true)->get(['id', 'name', 'price', 'billing_period']),
            'aiProviders' => AiProvider::active()->orderBy('name')->get(['id', 'name', 'type']),
            'builders' => Builder::active()->orderBy('name')->get(['id', 'name']),
            'languages' => Language::active()->orderBy('sort_order')->get(['code', 'name', 'native_name']),
            'notificationEvents' => $this->getNotificationEventOptions(),
            'autoUpdateActive' => app(PluginManager::class)->isActive('auto-update'),
        ]);
    }

    /**
     * Get updates settings.
     */
    protected function getUpdatesSettings(): array
    {
        $svc = app(UpdateService::class);

        return [
            'current_version' => $svc->currentVersion(),
            'update_available' => (bool) SystemSetting::get('update_available', false),
            'latest' => SystemSetting::get('update_latest'),
            'changelog' => SystemSetting::get('update_changelog'),
            'purchase_code_configured' => ! empty($svc->purchaseCode()),
            'auto_apply' => $svc->autoApply(),
            'builders' => $svc->enabled() ? app(BuilderUpdateService::class)->status() : [],
        ];
    }

    /**
     * Guard update action endpoints behind the auto-update plugin being active.
     */
    private function guardUpdates(): ?JsonResponse
    {
        if (! app(PluginManager::class)->isActive('auto-update')) {
            return response()->json(['error' => __('Auto Update is not active.')], 403);
        }

        return null;
    }

    /**
     * Check for an available update.
     */
    public function updatesCheck(): JsonResponse
    {
        if ($g = $this->guardUpdates()) {
            return $g;
        }

        if ($this->denyIfDemo()) {
            return response()->json(['error' => __('This action is disabled in demo mode.')], 403);
        }

        $res = app(UpdateService::class)->check();

        if (! empty($res['error'])) {
            $message = $res['error'] === 'unreachable'
                ? __('Could not reach the update server. Please try again later.')
                : __('The update server rejected the request. Please verify your license is valid.');

            return response()->json(['error' => $message], 502);
        }

        SystemSetting::set('update_available', (bool) ($res['update'] ?? false), 'boolean', 'general');
        if (! empty($res['latest'])) {
            SystemSetting::set('update_latest', $res['latest'], 'string', 'general');
            SystemSetting::set('update_changelog', $res['changelog'] ?? '', 'string', 'general');
        }

        return response()->json($res);
    }

    /**
     * Verify a purchase code against the update server.
     */
    /**
     * Dispatch the apply-update job.
     */
    public function updatesApply(): JsonResponse
    {
        if ($g = $this->guardUpdates()) {
            return $g;
        }

        if ($this->denyIfDemo()) {
            return response()->json(['error' => __('This action is disabled in demo mode.')], 403);
        }

        $res = app(UpdateService::class)->check();
        if (empty($res['download_url'])) {
            return response()->json(['error' => __('No update available.')], 422);
        }

        // Seed an initial status so the progress poller reflects this run immediately
        // (and a stale "success" from a previous update can't be misread as done).
        $statusPath = storage_path('app/updates/status.json');
        if (! is_dir(dirname($statusPath))) {
            @mkdir(dirname($statusPath), 0775, true);
        }
        @file_put_contents($statusPath, json_encode([
            'state' => 'preparing',
            'phase' => 'queued',
            'percent' => 5,
            'message' => 'Queued — preparing update',
        ]));

        try {
            ApplyUpdateJob::dispatch(UpdateService::HOST.$res['download_url'], (int) auth()->id());
        } catch (\Throwable $e) {
            // Under QUEUE_CONNECTION=sync the job runs inline, so a prepare-phase
            // failure (download from the update server, backup, etc.) surfaces here.
            // The job already records a 'failed' status; mirror it defensively and
            // report the error so the UI shows it instead of a frozen progress bar.
            @file_put_contents($statusPath, json_encode([
                'state' => 'failed',
                'phase' => 'failed',
                'percent' => 100,
                'message' => $e->getMessage(),
            ]));

            return response()->json(['error' => __('Update failed').': '.$e->getMessage()], 500);
        }

        return response()->json(['started' => true]);
    }

    /**
     * Trigger a builder self-update sync.
     */
    public function updatesBuilder(Request $request): JsonResponse
    {
        if ($g = $this->guardUpdates()) {
            return $g;
        }

        if ($this->denyIfDemo()) {
            return response()->json(['error' => __('This action is disabled in demo mode.')], 403);
        }

        $builderId = $request->integer('builder_id') ?: null;

        return response()->json(app(BuilderUpdateService::class)->sync($builderId));
    }

    /**
     * Read the current apply-update status file.
     */
    public function updatesStatus(): JsonResponse
    {
        if ($g = $this->guardUpdates()) {
            return $g;
        }

        $path = storage_path('app/updates/status.json');
        $decoded = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;

        // Fall back to "idle" if the file is absent, empty, or mid-write (torn/malformed JSON)
        // so the poller never receives a null body that would crash the client.
        return response()->json(is_array($decoded) ? $decoded : ['state' => 'idle']);
    }

    /**
     * Pull latest code from GitHub with backup and rollback.
     */
    public function updatesPull(): JsonResponse
    {
        if ($g = $this->guardUpdates()) {
            return $g;
        }

        if ($this->denyIfDemo()) {
            return response()->json(['error' => __('This action is disabled in demo mode.')], 403);
        }

        // Check if git repo is configured
        $repoResult = Process::path(base_path())->run('git remote get-url origin 2>/dev/null');
        if (!$repoResult->successful()) {
            return response()->json(['error' => __('No Git repository configured. Please set up Git remote origin.')], 422);
        }

        // Seed initial status (use same path as official updates so polling works)
        $statusPath = storage_path('app/updates/status.json');
        if (! is_dir(dirname($statusPath))) {
            @mkdir(dirname($statusPath), 0775, true);
        }
        @file_put_contents($statusPath, json_encode([
            'state' => 'preparing',
            'phase' => 'queued',
            'percent' => 5,
            'message' => 'Starting GitHub pull update...',
            'updated_at' => now()->toIso8601String(),
        ]));

        // Run the pull command in background via nohup
        // This allows it to run asynchronously while the user sees progress
        $logFile = storage_path('app/logs/pull_update.log');
        $artisanCmd = 'cd ' . base_path() . ' && php artisan app:pull-update --branch=main > ' . $logFile . ' 2>&1 &';
        exec($artisanCmd);

        return response()->json(['started' => true, 'message' => 'Update started. Check progress below.']);
    }

    /**
     * Update general settings.
     */
    public function updateGeneral(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'site_name' => 'required|string|max:255',
            'site_description' => 'nullable|string|max:500',
            'site_tagline' => 'nullable|string|max:100',
            'default_theme' => 'required|in:light,dark,system',
            'color_theme' => 'required|in:neutral,blue,green,orange,red,rose,violet,yellow',
            'default_locale' => 'required|string|max:10|exists:languages,code,is_active,1',
            'timezone' => 'required|string|timezone',
            'date_format' => ['required', 'string', Rule::in(['Y-m-d', 'd/m/Y', 'm/d/Y', 'F j, Y', 'M j, Y'])],
            'landing_page_enabled' => 'boolean',
            'default_currency' => 'required|string|size:3|in:'.implode(',', CurrencyHelper::getSupportedCurrencies()),
            'sentry_enabled' => 'nullable|boolean',
            'sentry_dsn' => 'nullable|string|max:500',
            'sentry_endpoint' => 'nullable|url|max:500',
            'purchase_code' => 'nullable|string|max:255',
            'maintenance_message' => 'nullable|string|max:500',
            'maintenance_retry' => 'nullable|integer|min:5|max:3600',
        ]);

        // Don't overwrite purchase code if empty (keep existing)
        if (empty($validated['purchase_code'])) {
            unset($validated['purchase_code']);
        }

        // Credit packs always bill in the system currency (they carry no
        // independent currency of their own). If the default currency changed,
        // cascade it to existing packs so the admin doesn't have to re-save each
        // one. Past transactions are intentionally left untouched — they record
        // the currency the customer was actually charged in.
        $previousCurrency = CurrencyHelper::getCode();
        $newCurrency = strtoupper($validated['default_currency']);

        DB::transaction(function () use ($validated, $previousCurrency, $newCurrency) {
            SystemSetting::setMany($validated, 'general');

            if ($newCurrency !== $previousCurrency) {
                CreditPack::query()->update(['currency' => $newCurrency]);
            }
        });

        return back()->with('success', __('General settings updated successfully.'));
    }

    /**
     * Upload logo or favicon.
     */
    public function uploadBranding(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'type' => 'required|in:logo,logo_dark,favicon',
            'file' => 'required|image|mimes:png,jpg,jpeg,svg,ico|max:2048',
        ]);

        $type = $request->input('type');
        $file = $request->file('file');
        $settingKey = "site_{$type}";

        // Delete old file if exists
        $oldPath = SystemSetting::get($settingKey);
        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        // Store new file
        $path = $file->store('branding', 'public');

        SystemSetting::set($settingKey, $path, 'string', 'general');

        return back()->with('success', __(':type uploaded successfully.', ['type' => ucfirst(str_replace('_', ' ', $type))]));
    }

    /**
     * Delete branding file (logo or favicon).
     */
    public function deleteBranding(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'type' => 'required|in:logo,logo_dark,favicon',
        ]);

        $type = $request->input('type');
        $settingKey = "site_{$type}";

        $path = SystemSetting::get($settingKey);
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        SystemSetting::remove($settingKey);

        return back()->with('success', __(':type removed successfully.', ['type' => ucfirst(str_replace('_', ' ', $type))]));
    }

    /**
     * Update plans settings.
     */
    public function updatePlans(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'default_plan_id' => 'nullable|exists:plans,id',
            'default_ai_provider_id' => 'nullable|exists:ai_providers,id',
            'default_builder_id' => 'nullable|exists:builders,id',
        ]);

        // Handle nullable integer settings - need to set each one individually
        // to properly handle null values (clearing defaults)
        $this->setNullableIntegerSetting('default_plan_id', $validated, 'plans');
        $this->setNullableIntegerSetting('default_ai_provider_id', $validated, 'plans');
        $this->setNullableIntegerSetting('default_builder_id', $validated, 'plans');

        return back()->with('success', __('Plans settings updated successfully.'));
    }

    /**
     * Update auth/social login settings.
     */
    public function updateAuth(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'enable_registration' => 'boolean',
            'require_email_verification' => 'boolean',
            'recaptcha_enabled' => 'boolean',
            'recaptcha_site_key' => 'nullable|string|max:255',
            'recaptcha_secret_key' => 'nullable|string|max:255',
            'google_login_enabled' => 'boolean',
            'google_client_id' => 'nullable|string|max:255',
            'google_client_secret' => 'nullable|string|max:255',
            'facebook_login_enabled' => 'boolean',
            'facebook_client_id' => 'nullable|string|max:255',
            'facebook_client_secret' => 'nullable|string|max:255',
            'github_login_enabled' => 'boolean',
            'github_client_id' => 'nullable|string|max:255',
            'github_client_secret' => 'nullable|string|max:255',
            'session_timeout' => 'required|integer|min:5|max:1440',
            'password_min_length' => 'required|integer|min:6|max:128',
        ]);

        // Handle secrets - don't overwrite if empty (keep existing)
        $secretFields = ['recaptcha_secret_key', 'google_client_secret', 'facebook_client_secret', 'github_client_secret'];
        foreach ($secretFields as $field) {
            if (empty($validated[$field])) {
                unset($validated[$field]);
            }
        }

        SystemSetting::setMany($validated, 'auth');

        return back()->with('success', __('Authentication settings updated successfully.'));
    }

    /**
     * Update email settings.
     */
    public function updateEmail(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'mail_mailer' => 'required|in:smtp,sendmail',
            'smtp_host' => 'nullable|string|max:255',
            'smtp_port' => 'nullable|integer|min:1|max:65535',
            'smtp_username' => 'nullable|string|max:255',
            'smtp_password' => 'nullable|string|max:255',
            'smtp_encryption' => 'nullable|in:tls,ssl,none',
            'mail_from_address' => 'required|email|max:255',
            'mail_from_name' => 'required|string|max:255',
            'admin_notification_email' => 'nullable|email|max:255',
            'admin_notification_events' => 'nullable|array',
        ]);

        // Don't overwrite password if empty
        if (empty($validated['smtp_password'])) {
            unset($validated['smtp_password']);
        }

        SystemSetting::setMany($validated, 'email');

        return back()->with('success', __('Email settings updated successfully.'));
    }

    /**
     * Test email configuration.
     */
    public function testEmail(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        try {
            // Apply current settings to mail config
            $this->applyMailConfig();

            $appName = SystemSetting::get('site_name', config('app.name'));

            Mail::raw(__('This is a test email from your :app application. Your email configuration is working correctly!', ['app' => $appName]), function ($message) use ($validated, $appName) {
                $message->to($validated['email'])
                    ->subject($appName.' Test Email');
            });

            return back()->with('success', __('Test email sent successfully to :email', ['email' => $validated['email']]));
        } catch (\Exception $e) {
            return back()->withErrors(['email' => __('Failed to send test email').': '.$e->getMessage()]);
        }
    }

    /**
     * Update GDPR/privacy settings.
     */
    public function updateGdpr(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'privacy_policy_version' => 'required|string|max:20',
            'terms_policy_version' => 'required|string|max:20',
            'cookie_policy_version' => 'required|string|max:20',
            'data_retention_days_transactions' => 'required|integer|min:365',
            'data_retention_days_inactive_accounts' => 'required|integer|min:30',
            'data_retention_days_projects' => 'required|integer|min:7',
            'data_retention_days_audit_logs' => 'required|integer|min:30',
            'data_retention_days_exports' => 'required|integer|min:1',
            'account_deletion_grace_days' => 'required|integer|min:1|max:30',
            'data_export_rate_limit_hours' => 'required|integer|min:1',
            'cookie_consent_enabled' => 'boolean',
            'data_export_enabled' => 'boolean',
            'account_deletion_enabled' => 'boolean',
        ]);

        SystemSetting::setMany($validated, 'gdpr');

        return back()->with('success', __('Privacy settings updated successfully.'));
    }

    /**
     * Get general settings.
     */
    protected function getGeneralSettings(): array
    {
        $settings = SystemSetting::getGroup('general');

        return [
            'site_name' => $settings['site_name'] ?? config('app.name'),
            'site_description' => $settings['site_description'] ?? '',
            'site_tagline' => $settings['site_tagline'] ?? '',
            'site_logo' => $settings['site_logo'] ?? null,
            'site_logo_dark' => $settings['site_logo_dark'] ?? null,
            'site_favicon' => $settings['site_favicon'] ?? null,
            'default_theme' => $settings['default_theme'] ?? 'system',
            'color_theme' => $settings['color_theme'] ?? 'neutral',
            'default_locale' => $settings['default_locale'] ?? 'en',
            'timezone' => $settings['timezone'] ?? 'UTC',
            'date_format' => $settings['date_format'] ?? 'Y-m-d',
            'landing_page_enabled' => $settings['landing_page_enabled'] ?? true,
            'default_currency' => $settings['default_currency'] ?? 'USD',
            'sentry_enabled' => $settings['sentry_enabled'] ?? false,
            'sentry_dsn' => $settings['sentry_dsn'] ?? null,
            'sentry_endpoint' => $settings['sentry_endpoint'] ?? null,
            'purchase_code_configured' => ! empty($settings['purchase_code']),
            'maintenance_message' => $settings['maintenance_message'] ?? '',
            'maintenance_retry' => (int) ($settings['maintenance_retry'] ?? 60),
        ];
    }

    /**
     * Get plans settings.
     */
    protected function getPlansSettings(): array
    {
        $settings = SystemSetting::getGroup('plans');

        return [
            'default_plan_id' => $settings['default_plan_id'] ?? null,
            'default_ai_provider_id' => $settings['default_ai_provider_id'] ?? null,
            'default_builder_id' => $settings['default_builder_id'] ?? null,
        ];
    }

    /**
     * Get referral settings.
     */
    protected function getReferralSettings(): array
    {
        $settings = SystemSetting::getGroup('referral');

        return [
            'referral_enabled' => (bool) ($settings['referral_enabled'] ?? true),
            'referral_commission_percent' => (int) ($settings['referral_commission_percent'] ?? 20),
            'referral_signup_bonus' => (float) ($settings['referral_signup_bonus'] ?? 0),
            'referral_referee_signup_bonus' => (int) ($settings['referral_referee_signup_bonus'] ?? 0),
            'referral_min_redemption' => (float) ($settings['referral_min_redemption'] ?? 5.00),
        ];
    }

    /**
     * Get domain settings.
     */
    protected function getDomainSettings(): array
    {
        $settings = SystemSetting::getGroup('domains');

        $blockedSubdomains = $settings['domain_blocked_subdomains'] ?? [];
        if (is_string($blockedSubdomains)) {
            $blockedSubdomains = json_decode($blockedSubdomains, true) ?? [];
        }

        return [
            'domain_enable_subdomains' => (bool) ($settings['domain_enable_subdomains'] ?? false),
            'domain_enable_custom_domains' => (bool) ($settings['domain_enable_custom_domains'] ?? false),
            'domain_base_domain' => $settings['domain_base_domain'] ?? '',
            'domain_server_ip' => $settings['domain_server_ip'] ?? '',
            'domain_blocked_subdomains' => $blockedSubdomains,
        ];
    }

    /**
     * Update domain settings.
     */
    public function updateDomains(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'domain_enable_subdomains' => 'boolean',
            'domain_enable_custom_domains' => 'boolean',
            'domain_base_domain' => 'nullable|string|max:255',
            'domain_server_ip' => ['nullable', 'string', 'ip'],
            'domain_blocked_subdomains' => 'nullable|array',
            'domain_blocked_subdomains.*' => 'string|max:63',
        ]);

        // Normalize base domain - remove protocol, trailing slash, etc.
        if (! empty($validated['domain_base_domain'])) {
            $validated['domain_base_domain'] = CustomDomainHelper::normalize($validated['domain_base_domain']);
        }

        // Normalize blocked subdomains
        if (! empty($validated['domain_blocked_subdomains'])) {
            $validated['domain_blocked_subdomains'] = array_values(array_unique(
                array_map('strtolower', array_filter($validated['domain_blocked_subdomains']))
            ));
        } else {
            $validated['domain_blocked_subdomains'] = [];
        }

        SystemSetting::setMany($validated, 'domains');

        // Clear domain settings cache
        DomainSettingService::clearCache();

        return back()->with('success', __('Domain settings updated successfully.'));
    }

    /**
     * Update referral settings.
     */
    public function updateReferral(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'referral_enabled' => 'boolean',
            'referral_commission_percent' => 'required|integer|min:0|max:100',
            'referral_signup_bonus' => 'required|numeric|min:0',
            'referral_referee_signup_bonus' => 'required|integer|min:0',
            'referral_min_redemption' => 'required|numeric|min:0',
        ]);

        SystemSetting::setMany($validated, 'referral');

        return back()->with('success', __('Referral settings updated successfully.'));
    }

    /**
     * Get auth settings with secret indicators.
     */
    protected function getAuthSettings(): array
    {
        $settings = SystemSetting::getGroup('auth');

        $result = [
            'enable_registration' => $settings['enable_registration'] ?? true,
            'require_email_verification' => $settings['require_email_verification'] ?? true,
            'recaptcha_enabled' => $settings['recaptcha_enabled'] ?? false,
            'recaptcha_site_key' => $settings['recaptcha_site_key'] ?? '',
            'recaptcha_has_secret' => ! empty($settings['recaptcha_secret_key']),
            'google_login_enabled' => $settings['google_login_enabled'] ?? false,
            'google_client_id' => $settings['google_client_id'] ?? '',
            'google_has_secret' => ! empty($settings['google_client_secret']),
            'facebook_login_enabled' => $settings['facebook_login_enabled'] ?? false,
            'facebook_client_id' => $settings['facebook_client_id'] ?? '',
            'facebook_has_secret' => ! empty($settings['facebook_client_secret']),
            'github_login_enabled' => $settings['github_login_enabled'] ?? false,
            'github_client_id' => $settings['github_client_id'] ?? '',
            'github_has_secret' => ! empty($settings['github_client_secret']),
            'session_timeout' => (int) ($settings['session_timeout'] ?? 120),
            'password_min_length' => (int) ($settings['password_min_length'] ?? 8),
        ];

        if (config('app.demo')) {
            $mask = '********';
            $result['recaptcha_site_key'] = $mask;
            $result['google_client_id'] = $mask;
            $result['facebook_client_id'] = $mask;
            $result['github_client_id'] = $mask;
        }

        return $result;
    }

    /**
     * Get email settings.
     */
    protected function getEmailSettings(): array
    {
        $settings = SystemSetting::getGroup('email');

        $result = [
            'mail_mailer' => $settings['mail_mailer'] ?? 'smtp',
            'smtp_host' => $settings['smtp_host'] ?? '',
            'smtp_port' => (int) ($settings['smtp_port'] ?? 587),
            'smtp_username' => $settings['smtp_username'] ?? '',
            'smtp_has_password' => ! empty($settings['smtp_password']),
            'smtp_encryption' => $settings['smtp_encryption'] ?? 'tls',
            'mail_from_address' => $settings['mail_from_address'] ?? '',
            'mail_from_name' => $settings['mail_from_name'] ?? config('app.name'),
            'admin_notification_email' => $settings['admin_notification_email'] ?? '',
            'admin_notification_events' => $settings['admin_notification_events'] ?? [],
        ];

        if (config('app.demo')) {
            $mask = '********';
            $result['smtp_host'] = $mask;
            $result['smtp_username'] = $mask;
            $result['mail_from_address'] = $mask;
            $result['admin_notification_email'] = $mask;
        }

        return $result;
    }

    /**
     * Get GDPR settings.
     */
    protected function getGdprSettings(): array
    {
        $settings = SystemSetting::getGroup('gdpr');

        return [
            'privacy_policy_version' => $settings['privacy_policy_version'] ?? '1.0',
            'terms_policy_version' => $settings['terms_policy_version'] ?? '1.0',
            'cookie_policy_version' => $settings['cookie_policy_version'] ?? '1.0',
            'data_retention_days_transactions' => (int) ($settings['data_retention_days_transactions'] ?? 2555),
            'data_retention_days_inactive_accounts' => (int) ($settings['data_retention_days_inactive_accounts'] ?? 730),
            'data_retention_days_projects' => (int) ($settings['data_retention_days_projects'] ?? 90),
            'data_retention_days_audit_logs' => (int) ($settings['data_retention_days_audit_logs'] ?? 365),
            'data_retention_days_exports' => (int) ($settings['data_retention_days_exports'] ?? 7),
            'account_deletion_grace_days' => (int) ($settings['account_deletion_grace_days'] ?? 7),
            'data_export_rate_limit_hours' => (int) ($settings['data_export_rate_limit_hours'] ?? 24),
            'cookie_consent_enabled' => $settings['cookie_consent_enabled'] ?? true,
            'data_export_enabled' => $settings['data_export_enabled'] ?? true,
            'account_deletion_enabled' => $settings['account_deletion_enabled'] ?? true,
        ];
    }

    /**
     * Get notification event options.
     */
    protected function getNotificationEventOptions(): array
    {
        return [
            ['value' => 'user_registered', 'label' => __('New User Registration')],
            ['value' => 'user_deleted', 'label' => __('User Account Deleted')],
            ['value' => 'subscription_activated', 'label' => __('Subscription Activated')],
            ['value' => 'subscription_cancelled', 'label' => __('Subscription Cancelled')],
            ['value' => 'subscription_expired', 'label' => __('Subscription Expired')],
            ['value' => 'payment_completed', 'label' => __('Payment Completed')],
            ['value' => 'bank_transfer_pending', 'label' => __('Bank Transfer Pending')],
        ];
    }

    /**
     * Update integration settings.
     */
    public function updateIntegrations(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'broadcast_driver' => 'nullable|string|in:pusher,reverb',
            'pusher_app_id' => 'nullable|string|max:255',
            'pusher_key' => 'nullable|string|max:255',
            'pusher_secret' => 'nullable|string|max:255',
            'pusher_cluster' => 'nullable|string|in:mt1,us2,us3,eu,ap1,ap2,ap3,ap4',
            'reverb_host' => 'nullable|required_if:broadcast_driver,reverb|string|max:255',
            'reverb_port' => 'nullable|integer|min:1|max:65535',
            'reverb_scheme' => 'nullable|string|in:http,https',
            'reverb_app_id' => 'nullable|string|max:255',
            'reverb_key' => 'nullable|string|max:255',
            'reverb_secret' => 'nullable|string|max:255',
            'internal_ai_provider_id' => 'nullable|exists:ai_providers,id',
            'internal_ai_model' => 'nullable|string|max:100',
        ]);

        // Don't overwrite secrets if empty (keep existing)
        foreach (['pusher_key', 'pusher_secret', 'reverb_key', 'reverb_secret'] as $field) {
            if (empty($validated[$field])) {
                unset($validated[$field]);
            }
        }

        // Handle nullable integer for internal_ai_provider_id
        $this->setNullableIntegerSetting('internal_ai_provider_id', $validated, 'integrations');
        unset($validated['internal_ai_provider_id']);

        // Handle internal_ai_model - allow empty string to clear
        if (array_key_exists('internal_ai_model', $validated)) {
            if (empty($validated['internal_ai_model'])) {
                SystemSetting::remove('internal_ai_model');
            } else {
                SystemSetting::set('internal_ai_model', $validated['internal_ai_model'], 'string', 'integrations');
            }
            unset($validated['internal_ai_model']);
        }

        SystemSetting::setMany($validated, 'integrations');

        // Clear caches when settings change
        InternalAiService::clearAllCache();
        BroadcastService::clearCache();

        return back()->with('success', __('Integration settings updated successfully.'));
    }

    /**
     * Test broadcast connection (Pusher or Reverb).
     */
    public function testBroadcast(Request $request)
    {
        if (config('app.demo')) {
            return response()->json(['success' => false, 'error' => __('This action is disabled in demo mode.')], 403);
        }

        $validated = $request->validate([
            'driver' => 'required|in:pusher,reverb',
            'app_id' => 'required|string',
            'key' => 'required|string',
            'secret' => 'required|string',
            'cluster' => 'nullable|string',
            'host' => 'nullable|string',
            'port' => 'nullable|integer',
            'scheme' => 'nullable|in:http,https',
        ]);

        // Fall back to saved credentials when placeholder values are sent
        if ($validated['key'] === '[existing]' || $validated['secret'] === '[existing]') {
            $settings = SystemSetting::getGroup('integrations');
            if ($validated['driver'] === 'reverb') {
                $validated['key'] = $validated['key'] === '[existing]' ? ($settings['reverb_key'] ?? '') : $validated['key'];
                $validated['secret'] = $validated['secret'] === '[existing]' ? ($settings['reverb_secret'] ?? '') : $validated['secret'];
            } else {
                $validated['key'] = $validated['key'] === '[existing]' ? ($settings['pusher_key'] ?? '') : $validated['key'];
                $validated['secret'] = $validated['secret'] === '[existing]' ? ($settings['pusher_secret'] ?? '') : $validated['secret'];
            }
        }

        try {
            $options = ['useTLS' => true];

            if ($validated['driver'] === 'reverb') {
                $scheme = $validated['scheme'] ?? 'https';
                $options['host'] = $validated['host'] ?? 'localhost';
                $options['port'] = $validated['port'] ?? 8080;
                $options['scheme'] = $scheme;
                $options['useTLS'] = $scheme === 'https';
            } else {
                $options['cluster'] = $validated['cluster'] ?? 'mt1';
            }

            $pusher = new Pusher(
                $validated['key'],
                $validated['secret'],
                $validated['app_id'],
                $options
            );

            // Use trigger on a test channel - works reliably with both Pusher and Reverb
            $pusher->trigger('broadcast-connection-test', 'test', ['ping' => true]);

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }
    }

    /**
     * Get integration settings.
     */
    protected function getIntegrationSettings(): array
    {
        $settings = SystemSetting::getGroup('integrations');

        $result = [
            'broadcast_driver' => $settings['broadcast_driver'] ?? 'pusher',
            'pusher_app_id' => $settings['pusher_app_id'] ?? '',
            'pusher_has_key' => ! empty($settings['pusher_key']),
            'pusher_has_secret' => ! empty($settings['pusher_secret']),
            'pusher_cluster' => $settings['pusher_cluster'] ?? 'mt1',
            'reverb_host' => $settings['reverb_host'] ?? '',
            'reverb_port' => (int) ($settings['reverb_port'] ?? 8080),
            'reverb_scheme' => $settings['reverb_scheme'] ?? 'https',
            'reverb_app_id' => $settings['reverb_app_id'] ?? '',
            'reverb_has_key' => ! empty($settings['reverb_key']),
            'reverb_has_secret' => ! empty($settings['reverb_secret']),
            'internal_ai_provider_id' => $settings['internal_ai_provider_id'] ?? null,
            'internal_ai_model' => $settings['internal_ai_model'] ?? '',
        ];

        if (config('app.demo')) {
            $mask = '********';
            $result['pusher_app_id'] = $mask;
            $result['reverb_host'] = $mask;
            $result['reverb_app_id'] = $mask;
        }

        return $result;
    }

    /**
     * Apply mail configuration from settings.
     */
    protected function applyMailConfig(): void
    {
        // Shared with AppServiceProvider so the admin Test Email uses exactly
        // the same driver/credentials resolution as the rest of the app.
        MailConfigurator::apply();
    }

    /**
     * Set or clear a nullable integer setting.
     *
     * If the value is null, the setting is deleted entirely.
     * Otherwise, the value is stored as an integer.
     */
    protected function setNullableIntegerSetting(string $key, array $validated, string $group): void
    {
        if (! array_key_exists($key, $validated)) {
            return;
        }

        $value = $validated[$key];

        if ($value === null) {
            SystemSetting::remove($key);
        } else {
            SystemSetting::set($key, $value, 'integer', $group);
        }
    }

    /**
     * Check which active payment gateways support a given currency.
     */
    public function checkCurrencyCompatibility(string $currency): JsonResponse
    {
        $currency = strtoupper($currency);

        if (strlen($currency) !== 3) {
            return response()->json(['error' => __('Invalid currency code')], 400);
        }

        return response()->json(
            CurrencyHelper::checkGatewayCompatibility($currency)
        );
    }
}
