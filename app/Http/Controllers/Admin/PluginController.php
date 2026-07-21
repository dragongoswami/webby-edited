<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Models\Plugin;
use App\Services\AuditLogService;
use App\Services\PluginManager;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PluginController extends Controller
{
    use ChecksDemoMode;

    public function __construct(
        private PluginManager $pluginManager
    ) {}

    /**
     * Display a listing of plugins.
     */
    public function index()
    {
        $plugins = $this->pluginManager->getPluginsForAdmin();

        return Inertia::render('Admin/Plugins', [
            'plugins' => $plugins,
        ]);
    }

    /**
     * Upload and install a plugin from ZIP file.
     */
    public function upload(Request $request)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'plugin' => 'required|file|mimes:zip|max:10240',
        ]);

        try {
            $plugin = $this->pluginManager->installFromZip($request->file('plugin'));

            $message = $plugin->wasRecentlyCreated
                ? __('Plugin installed successfully.')
                : __('Plugin updated successfully.');

            return back()->with('success', $message);
        } catch (\Exception $e) {
            return back()->withErrors(['plugin' => $e->getMessage()]);
        }
    }

    /**
     * Install a plugin.
     */
    public function install(string $slug)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        try {
            $this->pluginManager->install($slug);

            return back()->with('success', __('Plugin installed successfully.'));
        } catch (\Exception $e) {
            return back()->withErrors(['plugin' => $e->getMessage()]);
        }
    }

    /**
     * Configure a plugin.
     */
    public function configure(Request $request, string $slug)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $plugin = Plugin::where('slug', $slug)->first();

        if (! $plugin) {
            return back()->withErrors(['plugin' => __('Plugin not found. Please install it first.')]);
        }

        try {
            // Only pass schema-defined fields (strips _token, _method, etc.)
            $instance = $plugin->getInstance();
            $schema = $instance->getConfigSchema();
            $allowedKeys = collect($schema)->pluck('name')->all();
            $submitted = $request->only($allowedKeys);

            // If the admin left a password field unchanged, they submitted the mask
            // sentinel back. Restore the real stored value so we don't overwrite it.
            $submitted = $this->pluginManager->restoreMaskedPasswordFields(
                $schema,
                $submitted,
                $plugin->config ?? []
            );

            // Compute changed field names BEFORE saving (compare against current config).
            // Values are intentionally excluded to prevent secrets from appearing in logs.
            $current = $plugin->config ?? [];
            $changedFields = array_keys(array_filter(
                $submitted,
                fn ($value, string $key) => ! array_key_exists($key, $current) || $current[$key] !== $value,
                ARRAY_FILTER_USE_BOTH
            ));

            // Configure validates and saves (readonly fields are stripped automatically)
            $this->pluginManager->configure($plugin, $submitted);

            // Audit log: record which fields changed, never the values
            AuditLogService::logPluginConfigure(
                $request->user(),
                $slug,
                $changedFields
            );

            return back()->with('success', __('Plugin configured successfully.'));
        } catch (\Exception $e) {
            return back()->withErrors(['config' => $e->getMessage()]);
        }
    }

    /**
     * Toggle plugin active status.
     */
    public function toggle(string $slug)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $plugin = Plugin::where('slug', $slug)->first();

        if (! $plugin) {
            return back()->withErrors(['plugin' => __('Plugin not found. Please install it first.')]);
        }

        try {
            // If activating, check if plugin is configured
            if ($plugin->status === 'inactive') {
                $instance = $plugin->getInstance();

                if (! $instance->isConfigured()) {
                    return back()->withErrors(['plugin' => __('Please configure the plugin before activating it.')]);
                }

                $plugin->activate();
            } else {
                $plugin->deactivate();
            }

            $status = $plugin->status === 'active' ? 'activated' : 'deactivated';

            return back()->with('success', __('Plugin :status successfully.', ['status' => $status]));
        } catch (\Exception $e) {
            return back()->withErrors(['plugin' => $e->getMessage()]);
        }
    }

    /**
     * Get plugin configuration schema.
     */
    public function getConfigSchema(string $slug)
    {
        $plugin = Plugin::where('slug', $slug)->first();

        if (! $plugin) {
            // Try to get from discovered plugins
            $discovered = $this->pluginManager->discover();
            $pluginData = collect($discovered)->firstWhere('slug', $slug);

            if (! $pluginData) {
                return response()->json(['error' => __('Plugin not found')], 404);
            }

            // Create temporary instance to get schema
            $class = $pluginData['namespace'];
            try {
                $instance = new $class;
            } catch (\Throwable $e) {
                return response()->json(['error' => __('Plugin class could not be loaded')], 500);
            }

            return response()->json([
                'schema' => $instance->getConfigSchema(),
                'config' => [],
            ]);
        }

        $instance = $plugin->getInstance();
        $schema = $instance->getConfigSchema();
        $config = $this->pluginManager->maskPasswordFields($schema, $plugin->config ?? []);

        return response()->json([
            'schema' => $schema,
            'config' => $config,
        ]);
    }

    /**
     * Uninstall a plugin.
     */
    public function uninstall(string $slug)
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $plugin = Plugin::where('slug', $slug)->first();

        if (! $plugin) {
            return back()->withErrors(['plugin' => __('Plugin not found.')]);
        }

        try {
            $this->pluginManager->uninstall($plugin);

            return back()->with('success', __('Plugin uninstalled successfully.'));
        } catch (\Exception $e) {
            return back()->withErrors(['plugin' => $e->getMessage()]);
        }
    }
}
