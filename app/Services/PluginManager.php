<?php

namespace App\Services;

use App\Contracts\PaymentGatewayPlugin;
use App\Contracts\Plugin as PluginContract;
use App\Contracts\SupportsOneTimePurchase;
use App\Helpers\CurrencyHelper;
use App\Models\Plugin;
use App\Models\ProjectFile;
use App\Models\Subscription;
use App\Models\TicketAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use ZipArchive;

class PluginManager
{
    /**
     * Discover all available plugins from the filesystem.
     */
    public function discover(): Collection
    {
        $plugins = collect();

        $pluginTypes = [
            'PaymentGateways' => 'payment_gateway',
            'BuilderCapabilities' => 'builder_capability',
            'StorageProviders' => 'storage_provider',
            'System' => 'system',
        ];

        foreach ($pluginTypes as $directory => $type) {
            $path = app_path("Plugins/{$directory}");

            if (! File::exists($path)) {
                continue;
            }

            // Scan plugin directories
            $pluginDirs = File::directories($path);

            foreach ($pluginDirs as $pluginDir) {
                $manifestPath = $pluginDir.'/plugin.json';

                if (! File::exists($manifestPath)) {
                    continue;
                }

                $manifest = json_decode(File::get($manifestPath), true);
                if (! $manifest) {
                    continue;
                }

                $plugins->push([
                    'slug' => $manifest['slug'],
                    'name' => $manifest['name'],
                    'description' => $manifest['description'],
                    'type' => $manifest['type'],
                    'version' => $manifest['version'],
                    'author' => $manifest['author'] ?? null,
                    'namespace' => $manifest['namespace'],
                    'main_class' => $manifest['main_class'] ?? null,
                    'icon' => $manifest['icon'] ?? null,
                    'path' => $pluginDir,
                ]);
            }
        }

        return $plugins;
    }

    /**
     * Boot all installed plugins.
     * Should be called from PluginServiceProvider.
     */
    public function boot(): void
    {
        try {
            $this->registerPluginAutoloading();
        } catch (\Exception $e) {
            // Database not accessible yet
            return;
        }
    }

    /**
     * Register PSR-4 autoloading for all plugin directories.
     * Ensures uploaded plugins are loadable without running composer dump-autoload.
     */
    private function registerPluginAutoloading(): void
    {
        $loader = require base_path('vendor/autoload.php');

        $pluginTypes = [
            'PaymentGateways' => 'App\\Plugins\\PaymentGateways\\',
            'BuilderCapabilities' => 'App\\Plugins\\BuilderCapabilities\\',
            'StorageProviders' => 'App\\Plugins\\StorageProviders\\',
            'System' => 'App\\Plugins\\System\\',
        ];

        foreach ($pluginTypes as $typeDirectory => $namespacePrefix) {
            $basePath = app_path("Plugins/{$typeDirectory}");

            if (! File::exists($basePath)) {
                continue;
            }

            $existingPaths = array_map('realpath', $loader->getPrefixesPsr4()[$namespacePrefix] ?? []);

            foreach (File::directories($basePath) as $pluginDir) {
                $srcPath = $pluginDir.'/src';
                if (File::isDirectory($srcPath) && ! in_array(realpath($srcPath), $existingPaths)) {
                    $loader->addPsr4($namespacePrefix, $srcPath);
                }
            }
        }
    }

    /**
     * Install a plugin from its slug.
     */
    public function install(string $slug): Plugin
    {
        $discovered = $this->discover()->firstWhere('slug', $slug);

        if (! $discovered) {
            throw new \Exception("Plugin {$slug} not found");
        }

        $className = $discovered['namespace'];

        if (! class_exists($className)) {
            throw new \Exception("Plugin class {$className} not found");
        }

        $instance = new $className;

        return Plugin::create([
            'name' => $instance->getName(),
            // Use the canonical manifest slug (matched in discover()), NOT a
            // slugified display name: Str::slug('Web Agent') => 'web-agent',
            // which would never match isActive('webagent') or the capability gate.
            'slug' => $discovered['slug'],
            'type' => $instance->getType(),
            'class' => $className,
            'version' => $instance->getVersion(),
            'status' => 'inactive',
            'installed_at' => now(),
        ]);
    }

    /**
     * Install a plugin from a ZIP file.
     *
     * @throws \Exception
     */
    public function installFromZip(UploadedFile $zipFile): Plugin
    {
        $zip = new ZipArchive;
        $tempDir = storage_path('app/temp_plugin_'.uniqid());
        $targetDir = null;
        $migratedFiles = [];

        try {
            // 1. Extract ZIP
            if ($zip->open($zipFile->getRealPath()) !== true) {
                throw new \Exception('Failed to open ZIP file');
            }

            // Validate ZIP entries for path traversal
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (str_contains($name, '..') || str_starts_with($name, '/') || str_contains($name, "\0")) {
                    $zip->close();
                    throw new \Exception("Invalid file path in ZIP archive: {$name}");
                }
            }

            File::makeDirectory($tempDir, 0755, true);
            $zip->extractTo($tempDir);
            $zip->close();

            // Check if contents are wrapped in a single subdirectory
            $contents = File::directories($tempDir);
            $workDir = $tempDir;
            if (count($contents) === 1 && File::isDirectory($contents[0])
                && File::exists($contents[0].'/plugin.json')) {
                $workDir = $contents[0];
            }

            // 2. Validate plugin.json
            $manifestPath = $workDir.'/plugin.json';
            if (! File::exists($manifestPath)) {
                throw new \Exception('plugin.json not found in ZIP file');
            }
            $manifest = json_decode(File::get($manifestPath), true);
            if (! $manifest) {
                throw new \Exception('Invalid plugin.json format');
            }
            $this->validateManifest($manifest);

            // 3. Validate requirements
            if (isset($manifest['requirements'])) {
                $this->validateRequirements($manifest['requirements']);
            }

            // 4. Detect an existing install — same-or-newer uploads update it
            //    in place (preserving config + active status); downgrades are
            //    rejected. Core plugins ship with the app and are not updatable
            //    through the uploader.
            $existing = Plugin::where('slug', $manifest['slug'])->first();
            $isUpdate = $existing !== null;
            if ($isUpdate) {
                if ($existing->isCorePlugin()) {
                    throw new \Exception("Plugin '{$manifest['name']}' is a core plugin and is updated with the application, not through the uploader.");
                }
                if (version_compare($manifest['version'], $existing->version, '<')) {
                    throw new \Exception("Cannot update '{$manifest['name']}': the uploaded version ({$manifest['version']}) is older than the installed version ({$existing->version}).");
                }
            }

            // 5. Validate main class file (with path containment check)
            $mainClassPath = realpath($workDir.'/'.$manifest['main_class']);
            if (! $mainClassPath || ! str_starts_with($mainClassPath, realpath($workDir).DIRECTORY_SEPARATOR)) {
                throw new \Exception("Invalid main_class path: {$manifest['main_class']}");
            }

            // 6. Determine target directory (PascalCase for PSR-4 compatibility)
            $typeDir = $this->getTypeDirectory($manifest['type']);
            $targetDir = app_path("Plugins/{$typeDir}/".Str::studly($manifest['slug']));

            // 6b. Guard against slug studly-collisions. Two different slugs can
            //     resolve to the same on-disk directory (e.g. "bank--transfer"
            //     and "bank-transfer" both → "BankTransfer"). Without this, a
            //     fresh install under a colliding slug would silently overwrite
            //     another installed plugin's files — including core plugins,
            //     bypassing the core-plugin guard above. Reject when the resolved
            //     directory already belongs to a different installed plugin.
            $dirOwner = Plugin::where('slug', '!=', $manifest['slug'])->get()
                ->first(fn (Plugin $p) => app_path('Plugins/'.$this->getTypeDirectory($p->type).'/'.Str::studly($p->slug)) === $targetDir);
            if ($dirOwner) {
                throw new \Exception("Plugin slug '{$manifest['slug']}' conflicts with the installed plugin '{$dirOwner->slug}' (both resolve to the same directory). Choose a different slug.");
            }

            // 7. Copy plugin files. On update, move the existing directory aside
            //    first so we can restore it if anything below fails.
            if (File::exists($targetDir)) {
                if ($isUpdate) {
                    $backupDir = storage_path('app/plugin_backup_'.uniqid());
                    File::moveDirectory($targetDir, $backupDir);
                } else {
                    File::deleteDirectory($targetDir);
                }
            }
            File::copyDirectory($workDir, $targetDir);

            // 8. Process migrations. On update, only run migrations that are new
            //    in this version — previously applied ones must not re-run (they
            //    would try to recreate existing tables).
            $migrationsToRun = $manifest['migrations'] ?? [];
            if ($isUpdate) {
                $previousMigrations = $existing->metadata['migrations'] ?? [];
                $alreadyApplied = array_map($this->migrationBasename(...), $previousMigrations);
                $migrationsToRun = array_values(array_filter(
                    $migrationsToRun,
                    fn ($m) => ! in_array($this->migrationBasename($m), $alreadyApplied, true)
                ));
            }
            if (! empty($migrationsToRun)) {
                $migratedFiles = $this->processMigrations($targetDir, $migrationsToRun);
            }

            // 9. Load and validate class
            $targetClassPath = realpath($targetDir.'/'.$manifest['main_class']);
            if (! $targetClassPath || ! str_starts_with($targetClassPath, realpath($targetDir).DIRECTORY_SEPARATOR)) {
                throw new \Exception("Invalid main_class path: {$manifest['main_class']}");
            }
            require_once $targetClassPath;
            $className = $manifest['namespace'];
            if (! class_exists($className)) {
                throw new \Exception("Plugin class {$className} not found");
            }
            $instance = new $className;
            if (! $instance instanceof PluginContract) {
                throw new \Exception('Plugin must implement Plugin interface');
            }

            // 10. Create or update the database record. On update we preserve
            //     the existing config, active status and install date, and keep
            //     the full migration list (previously applied + newly applied).
            $manifest['uploaded'] = true;
            if ($isUpdate) {
                $allMigrations = array_values(array_merge($existing->migrations ?? [], $migratedFiles));
                $existing->update([
                    'name' => $manifest['name'],
                    'type' => $manifest['type'],
                    'class' => $className,
                    'version' => $manifest['version'],
                    'metadata' => $manifest,
                    'migrations' => $allMigrations ?: null,
                ]);

                $plugin = $existing;
            } else {
                $plugin = Plugin::create([
                    'name' => $manifest['name'],
                    'slug' => $manifest['slug'],
                    'type' => $manifest['type'],
                    'class' => $className,
                    'version' => $manifest['version'],
                    'status' => 'inactive',
                    'metadata' => $manifest,
                    'migrations' => $migratedFiles ?: null,
                    'installed_at' => now(),
                ]);
            }

            // 11. The update is committed (files + DB) — discard the backup of
            //     the previous files. This runs ONLY on success; on failure the
            //     catch below restores the backup instead. Keeping backup cleanup
            //     out of `finally` is deliberate: a failure during the catch's
            //     own cleanup must never reach a blanket backup deletion.
            if (isset($backupDir) && File::exists($backupDir)) {
                File::deleteDirectory($backupDir);
            }

            return $plugin;
        } catch (\Exception $e) {
            // Cleanup on failure. Guard the delete so a filesystem error here
            // cannot bypass the backup restore below.
            try {
                if ($targetDir && File::exists($targetDir)) {
                    File::deleteDirectory($targetDir);
                }
            } catch (\Throwable) {
                // Fall through — restoring the previous install matters more.
            }
            // On a failed update, restore the previous plugin files so the
            // existing install is never left broken (overwrite any partial copy).
            if (isset($backupDir) && File::exists($backupDir) && $targetDir) {
                File::moveDirectory($backupDir, $targetDir, true);
            }
            foreach ($migratedFiles as $file) {
                $path = database_path("migrations/{$file}");
                if (File::exists($path)) {
                    File::delete($path);
                }
            }
            throw $e;
        } finally {
            if (File::exists($tempDir)) {
                File::deleteDirectory($tempDir);
            }
        }
    }

    /**
     * Normalize a manifest migration path to a comparable basename, stripping
     * any leading numeric ordering prefix (e.g. "001_create_foo.php" → "create_foo.php").
     */
    private function migrationBasename(string $migration): string
    {
        // Strip every leading numeric ordering segment so both integer prefixes
        // ("001_") and date prefixes ("2024_01_01_") normalize to the same key.
        $base = basename($migration);
        while (preg_match('/^\d+_/', $base)) {
            $base = preg_replace('/^\d+_/', '', $base);
        }

        return $base;
    }

    /**
     * Uninstall a plugin.
     *
     * @throws \Exception
     */
    public function uninstall(Plugin $plugin): void
    {
        // Check if core plugin
        if ($plugin->isCorePlugin()) {
            throw new \Exception("Cannot uninstall core plugin: {$plugin->name}. This plugin is required for the system to function.");
        }

        // Storage providers: block uninstall while active or while files still live
        // in their bucket, so existing project files don't become unreachable (their
        // disk credentials are tied to the plugin row).
        if ($plugin->type === 'storage_provider') {
            if ($plugin->isActive()) {
                throw new \Exception("Cannot uninstall {$plugin->name} while it is active. Switch to a different storage provider (or back to local) first.");
            }

            $fileCount = ProjectFile::where('disk', $plugin->slug)->count()
                + TicketAttachment::where('disk', $plugin->slug)->count();
            if ($fileCount > 0) {
                throw new \Exception("Cannot uninstall {$plugin->name}: {$fileCount} file(s) are still stored in this bucket. Delete or migrate them first.");
            }
        }

        // Payment gateways: block uninstall while subscriptions still reference them.
        // Covers: display name, slug, snake_case slug, and known Subscription constants.
        if ($plugin->type === 'payment_gateway') {
            $paymentMethodValues = array_unique(array_filter([
                $plugin->name,
                $plugin->slug,
                str_replace('-', '_', $plugin->slug),
                Subscription::getPaymentMethodConstant($plugin->slug),
            ]));

            $activeSubscriptions = Subscription::whereIn('payment_method', $paymentMethodValues)
                ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_PENDING])
                ->count();

            if ($activeSubscriptions > 0) {
                throw new \Exception("Cannot uninstall {$plugin->name}. There are {$activeSubscriptions} active or pending subscriptions using this payment method.");
            }
        }

        // Handle uploaded plugins: rollback migrations and delete files
        if ($plugin->isUploaded()) {
            // Rollback migrations in reverse order
            if ($plugin->hasMigrations()) {
                foreach (array_reverse($plugin->getMigrations()) as $file) {
                    $path = database_path("migrations/{$file}");
                    if (File::exists($path)) {
                        try {
                            Artisan::call('migrate:rollback', [
                                '--path' => "database/migrations/{$file}",
                                '--force' => true,
                            ]);
                        } catch (\Exception $e) {
                            // Log but continue - migration might already be rolled back
                            \Log::warning("Failed to rollback migration {$file}: ".$e->getMessage());
                        }
                        File::delete($path);
                    }
                }
            }

            // Delete plugin directory (check both slug and PascalCase variants)
            $typeDir = $this->getTypeDirectory($plugin->type);
            $pluginDir = $this->findPluginDirectory($typeDir, $plugin->slug);
            if ($pluginDir && File::exists($pluginDir)) {
                File::deleteDirectory($pluginDir);
            }
        }

        $plugin->delete();
    }

    /**
     * Configure a plugin with the provided configuration.
     */
    public function configure(Plugin $plugin, array $config): void
    {
        $instance = $plugin->getInstance();

        // Strip readonly fields — they are display-only and must never be stored.
        $readonlyFields = collect($instance->getConfigSchema())
            ->where('type', 'readonly')
            ->pluck('name')
            ->all();
        $config = array_diff_key($config, array_flip($readonlyFields));

        // Validate configuration
        $instance->validateConfig($config);

        // Merge into the existing config instead of full-replace, so that
        // any fields the form happens to omit (JS bug, A/B test, UI redesign)
        // do not silently wipe stored values. Submitted fields still overwrite,
        // and an explicit empty-string is a valid clear.
        $mergedConfig = array_merge($plugin->config ?? [], $config);
        $plugin->update(['config' => $mergedConfig]);
    }

    /**
     * Get all active payment gateway plugins.
     */
    public function getActiveGateways(): Collection
    {
        // A gateway whose plugin class can't be loaded (files missing, moved, or
        // installed at a different path than the autoloader expects) must never
        // take down checkout/billing for every other gateway — skip it (logged).
        return Plugin::active()
            ->byType('payment_gateway')
            ->get()
            ->map(fn ($plugin) => $this->safeGatewayInstance($plugin))
            ->filter()
            ->values();
    }

    /**
     * Instantiate a payment gateway plugin, returning null (and logging) instead
     * of throwing when its class can't be loaded. Keeps a single broken gateway
     * from 500-ing gateway listings and lookups; every caller already treats a
     * null gateway as "unavailable".
     */
    private function safeGatewayInstance(?Plugin $plugin): ?PaymentGatewayPlugin
    {
        if (! $plugin) {
            return null;
        }

        try {
            return $plugin->getInstance();
        } catch (\Throwable $e) {
            Log::warning('Skipping payment gateway whose plugin class could not be loaded', [
                'slug' => $plugin->slug,
                'class' => $plugin->class,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get active gateways that support a specific currency.
     */
    public function getActiveGatewaysForCurrency(?string $currency = null): Collection
    {
        $currency = $currency ?? CurrencyHelper::getCode();

        return $this->getActiveGateways()
            ->filter(function ($gateway) use ($currency) {
                $supported = $gateway->getSupportedCurrencies();

                // Empty array means all currencies supported
                return empty($supported) || in_array($currency, $supported);
            });
    }

    /**
     * Active gateways that support one-time purchases (e.g. credit packs) and
     * support the given currency.
     */
    public function getGatewaysSupportingOneTimePurchase(?string $currency = null): Collection
    {
        return $this->getActiveGatewaysForCurrency($currency)
            ->filter(fn ($gateway) => $gateway instanceof SupportsOneTimePurchase)
            ->values();
    }

    /**
     * Get a specific payment gateway plugin instance by name.
     */
    public function getGateway(string $name): ?PaymentGatewayPlugin
    {
        $plugin = Plugin::active()
            ->byType('payment_gateway')
            ->where('name', $name)
            ->first();

        return $this->safeGatewayInstance($plugin);
    }

    /**
     * Get a specific payment gateway plugin instance by slug.
     */
    public function getGatewayBySlug(string $slug): ?PaymentGatewayPlugin
    {
        $plugin = Plugin::active()
            ->byType('payment_gateway')
            ->where('slug', $slug)
            ->first();

        return $this->safeGatewayInstance($plugin);
    }

    /**
     * The sentinel value used to represent a masked password-type config field
     * in API responses. When the admin submits this value back unchanged, the
     * save logic must preserve the existing stored value instead of overwriting.
     */
    public const PASSWORD_MASK = '••••••••';

    /**
     * Mask password-type fields in a config array before sending to the browser.
     *
     * @param  array<string, mixed>  $schema  Plugin config schema
     * @param  array<string, mixed>  $config  Decrypted config values
     * @return array<string, mixed> Config with password fields replaced by PASSWORD_MASK
     */
    public function maskPasswordFields(array $schema, array $config): array
    {
        foreach ($schema as $field) {
            $name = $field['name'] ?? null;
            if ($this->isSecretField($field) && $name !== null && ! empty($config[$name])) {
                $config[$name] = self::PASSWORD_MASK;
            }
        }

        return $config;
    }

    /**
     * A field holds a secret (and must be masked on read / preserved on save)
     * when it is a password input OR explicitly flagged secret. The flag lets
     * non-password input types (e.g. a textarea holding a PEM private key) be
     * masked without masking every textarea field.
     *
     * @param  array<string, mixed>  $field
     */
    private function isSecretField(array $field): bool
    {
        return ($field['type'] ?? null) === 'password' || ($field['secret'] ?? false) === true;
    }

    /**
     * Restore any password-type fields that the admin left unchanged (i.e.
     * submitted the mask sentinel) by substituting back the currently-stored value.
     *
     * @param  array<string, mixed>  $schema  Plugin config schema
     * @param  array<string, mixed>  $submitted  Incoming request values
     * @param  array<string, mixed>  $current  Currently-stored (decrypted) config
     * @return array<string, mixed> Submitted values with sentinels replaced
     */
    public function restoreMaskedPasswordFields(array $schema, array $submitted, array $current): array
    {
        foreach ($schema as $field) {
            $name = $field['name'] ?? null;
            if ($this->isSecretField($field) && $name !== null) {
                if (($submitted[$name] ?? null) === self::PASSWORD_MASK) {
                    $submitted[$name] = $current[$name] ?? '';
                }
            }
        }

        return $submitted;
    }

    /**
     * Get all plugins with their data for admin UI.
     * Returns array suitable for Inertia props.
     * Core plugins are shown first.
     */
    public function getPluginsForAdmin(): array
    {
        $installed = Plugin::all()->keyBy('slug');

        return $this->discover()->map(function ($discovered) use ($installed) {
            $plugin = $installed->get($discovered['slug']);

            $instance = null;
            if (class_exists($discovered['namespace'])) {
                try {
                    $instance = new $discovered['namespace']($plugin?->config ?? []);
                } catch (\Throwable $e) {
                    // Plugin constructor failed — continue without instance data
                }
            }

            $isCore = $plugin?->isCorePlugin() ?? in_array($discovered['slug'], Plugin::CORE_PLUGINS);

            $schema = $instance?->getConfigSchema() ?? [];
            $config = $this->maskPasswordFields($schema, $plugin?->config ?? []);

            return [
                'id' => $plugin?->id,
                'slug' => $discovered['slug'],
                'name' => $discovered['name'],
                'description' => $discovered['description'],
                'type' => $discovered['type'],
                'version' => $discovered['version'],
                'author' => $discovered['author'],
                'icon' => $instance?->getIcon() ?? null,
                'is_installed' => $plugin !== null,
                'is_active' => $plugin?->isActive() ?? false,
                'is_configured' => $instance?->isConfigured() ?? false,
                'is_core' => $isCore,
                'config_schema' => $schema,
                'config' => $config,
            ];
        })
            ->sortByDesc('is_core')  // Core plugins first
            ->values()
            ->toArray();
    }

    /**
     * Check if a plugin is installed by slug.
     */
    public function isInstalled(string $slug): bool
    {
        return Plugin::where('slug', $slug)->exists();
    }

    /**
     * Check if a plugin is installed AND active by slug.
     */
    public function isActive(string $slug): bool
    {
        return Plugin::where('slug', $slug)
            ->where('status', 'active')
            ->exists();
    }

    /**
     * Get installed plugin by slug.
     */
    public function getInstalledPlugin(string $slug): ?Plugin
    {
        return Plugin::where('slug', $slug)->first();
    }

    /**
     * Active state of the plugin-gated builder capabilities.
     *
     * The single source of truth for whether the GitHub / WordPress / Web Agent
     * capabilities exist on this install at all. Used to gate both the admin plan
     * form toggles AND the pricing feature lines — a capability whose plugin is
     * not installed/active must never appear in either place. (Database and code
     * export are plain plan flags, not plugins, so they are not listed here.)
     *
     * @return array{webAgent: bool, github: bool, wordpress: bool, shopify: bool}
     */
    public function capabilityPluginStates(): array
    {
        return [
            'webAgent' => $this->isActive('webagent'),
            'github' => $this->isActive('github'),
            'wordpress' => $this->isActive('wordpress'),
            'shopify' => $this->isActive('shopify'),
        ];
    }

    /**
     * Activate a plugin.
     */
    public function activate(Plugin $plugin): void
    {
        $plugin->activate();
    }

    /**
     * Deactivate a plugin.
     */
    public function deactivate(Plugin $plugin): void
    {
        $plugin->deactivate();
    }

    /**
     * Toggle plugin active state.
     */
    public function toggle(Plugin $plugin): void
    {
        if ($plugin->isActive()) {
            $plugin->deactivate();
        } else {
            $plugin->activate();
        }
    }

    /**
     * Get the slug for a gateway instance.
     */
    public function getGatewaySlug(PaymentGatewayPlugin $gateway): ?string
    {
        // Match by the stored class name rather than instantiating every active
        // gateway just to resolve one slug — re-loading siblings here would let a
        // single unloadable gateway throw out of an otherwise-healthy lookup.
        $class = $gateway::class;

        $plugin = Plugin::active()
            ->byType('payment_gateway')
            ->get()
            ->first(fn ($p) => $p->class === $class);

        return $plugin?->slug;
    }

    /**
     * Validate plugin manifest required fields.
     *
     * @throws \Exception
     */
    private function validateManifest(array $manifest): void
    {
        $required = ['name', 'slug', 'type', 'main_class', 'namespace', 'version', 'author'];
        foreach ($required as $field) {
            if (empty($manifest[$field])) {
                throw new \Exception("Required field '{$field}' missing in plugin.json");
            }
        }

        // Prevent path traversal in main_class
        if (str_contains($manifest['main_class'], '..') || str_starts_with($manifest['main_class'], '/') || str_contains($manifest['main_class'], "\0")) {
            throw new \Exception("Invalid main_class path: {$manifest['main_class']}");
        }

        // Prevent path traversal in migration paths
        foreach ($manifest['migrations'] ?? [] as $migration) {
            if (str_contains($migration, '..') || str_starts_with($migration, '/') || str_contains($migration, "\0")) {
                throw new \Exception("Invalid migration path: {$migration}");
            }
        }

        // Prevent path traversal in slug
        if (! preg_match('/^[a-z0-9\-]{1,64}$/', $manifest['slug'])) {
            throw new \Exception('Plugin slug must contain only lowercase letters, numbers, and hyphens');
        }

        // Validate namespace belongs to plugin namespace
        if (! str_starts_with($manifest['namespace'], 'App\\Plugins\\')) {
            throw new \Exception('Plugin namespace must start with App\\Plugins\\');
        }
    }

    /**
     * Validate plugin requirements (PHP, Laravel versions).
     *
     * @throws \Exception
     */
    private function validateRequirements(array $requirements): void
    {
        if (isset($requirements['php'])) {
            $required = str_replace('>=', '', $requirements['php']);
            if (version_compare(PHP_VERSION, $required, '<')) {
                throw new \Exception("PHP {$required}+ required, found ".PHP_VERSION);
            }
        }
        if (isset($requirements['laravel'])) {
            $required = str_replace('>=', '', $requirements['laravel']);
            if (version_compare(app()->version(), $required, '<')) {
                throw new \Exception("Laravel {$required}+ required, found ".app()->version());
            }
        }
    }

    /**
     * Get the directory name for a plugin type.
     *
     * @throws \Exception
     */
    private function getTypeDirectory(string $type): string
    {
        return match ($type) {
            'payment_gateway' => 'PaymentGateways',
            'builder_capability' => 'BuilderCapabilities',
            'storage_provider' => 'StorageProviders',
            'system' => 'System',
            default => throw new \Exception("Unknown plugin type: {$type}"),
        };
    }

    /**
     * Find the actual plugin directory on disk, checking multiple naming conventions.
     */
    private function findPluginDirectory(string $typeDir, string $slug): ?string
    {
        $basePath = app_path("Plugins/{$typeDir}");
        $candidates = [
            $basePath.'/'.Str::studly($slug),
            $basePath.'/'.$slug,
        ];

        foreach ($candidates as $path) {
            if (File::exists($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Process plugin migrations: copy to database/migrations and run them.
     *
     * @return array List of migrated file names
     *
     * @throws \Exception
     */
    private function processMigrations(string $pluginDir, array $migrations): array
    {
        $migratedFiles = [];
        $timestamp = now()->format('Y_m_d_His');

        foreach ($migrations as $index => $migration) {
            $sourcePath = realpath($pluginDir.'/'.$migration);
            if (! $sourcePath || ! str_starts_with($sourcePath, realpath($pluginDir).DIRECTORY_SEPARATOR)) {
                throw new \Exception("Invalid migration path: {$migration}");
            }

            $sequence = str_pad($index, 3, '0', STR_PAD_LEFT);
            $basename = preg_replace('/^\d+_/', '', basename($migration));
            $destFilename = "{$timestamp}_{$sequence}_{$basename}";
            $destPath = database_path("migrations/{$destFilename}");

            File::copy($sourcePath, $destPath);

            try {
                Artisan::call('migrate', [
                    '--path' => "database/migrations/{$destFilename}",
                    '--force' => true,
                ]);
                $migratedFiles[] = $destFilename;
            } catch (\Exception $e) {
                // Cleanup the copied migration file on failure
                File::delete($destPath);
                throw new \Exception("Migration failed: {$basename}. Error: ".$e->getMessage());
            }
        }

        return $migratedFiles;
    }
}
