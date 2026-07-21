<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Models\Plan;
use App\Models\Template;
use App\Services\PluginManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use ZipArchive;

class AdminTemplateController extends Controller
{
    use ChecksDemoMode;

    /**
     * Display a listing of templates.
     */
    public function index(Request $request): Response
    {
        $wordpressEnabled = app(PluginManager::class)->isActive('wordpress');
        $shopifyEnabled = app(PluginManager::class)->isActive('shopify');

        // Theme output targets are only valid filters when their plugin is
        // installed (otherwise the param is ignored, since those rows are hidden).
        $outputTarget = $request->input('output_target');
        if (! in_array($outputTarget, ['website', 'wordpress_theme', 'shopify_theme'], true)) {
            $outputTarget = null;
        }
        if (! $wordpressEnabled && $outputTarget === 'wordpress_theme') {
            $outputTarget = null;
        }
        if (! $shopifyEnabled && $outputTarget === 'shopify_theme') {
            $outputTarget = null;
        }

        $search = trim((string) $request->input('search', ''));

        // Only the website target is always visible; each theme target is hidden
        // unless its plugin is active.
        $allowedTargets = ['website'];
        if ($wordpressEnabled) {
            $allowedTargets[] = 'wordpress_theme';
        }
        if ($shopifyEnabled) {
            $allowedTargets[] = 'shopify_theme';
        }

        $templates = Template::with('plans')
            // Hide theme templates whose plugin isn't installed.
            ->where(function ($w) use ($allowedTargets) {
                $w->whereIn('output_target', $allowedTargets)->orWhereNull('output_target');
            })
            ->when($outputTarget, fn ($q) => $q->where('output_target', $outputTarget))
            ->when($search !== '', fn ($q) => $q->where(function ($w) use ($search) {
                $w->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            }))
            ->latest()
            ->paginate($request->input('per_page', 10))
            // Append the *sanitized* filters (not the raw query) so pagination
            // links stay in sync with what the page actually shows.
            ->appends(array_filter([
                'search' => $search !== '' ? $search : null,
                'output_target' => $outputTarget,
                'per_page' => $request->query('per_page'),
            ], static fn ($v) => $v !== null && $v !== ''));

        return Inertia::render('Admin/Templates/Index', [
            'templates' => $templates,
            'plans' => Plan::orderBy('sort_order')->get(['id', 'name']),
            // Output-target UI is shown only when a theme plugin is installed +
            // active; each plugin gates its own output-type option.
            'wordpressEnabled' => $wordpressEnabled,
            'shopifyEnabled' => $shopifyEnabled,
            'filters' => [
                'search' => $search !== '' ? $search : null,
                'output_target' => $outputTarget,
            ],
        ]);
    }

    /**
     * Store a newly created template.
     */
    public function store(Request $request): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'thumbnail' => 'nullable|image|max:2048',
            'zip_file' => 'required|file|mimes:zip|max:10240', // 10MB max
            'output_target' => 'nullable|string|in:website,wordpress_theme,shopify_theme',
            'plan_ids' => 'nullable|array',
            'plan_ids.*' => 'exists:plans,id',
        ]);

        // Handle thumbnail upload
        if ($request->hasFile('thumbnail')) {
            $path = $request->file('thumbnail')->store('thumbnails', 'public');
            $validated['thumbnail'] = $path;
        }

        // Store zip file
        $zipPath = $request->file('zip_file')->store('templates', 'local');

        // Extract and validate template.json
        $metadata = null;
        $zip = new ZipArchive;

        $fullZipPath = Storage::disk('local')->path($zipPath);
        if ($zip->open($fullZipPath) === true) {
            $jsonContent = $zip->getFromName('template.json');
            if ($jsonContent) {
                $decoded = json_decode($jsonContent, true);
                if ($decoded && is_array($decoded)) {
                    $metadata = $decoded;
                }
            }
            $zip->close();
        }

        // WordPress templates can only be created while the plugin is installed.
        $outputTarget = $validated['output_target'] ?? 'website';
        if ($outputTarget === 'wordpress_theme' && ! app(PluginManager::class)->isActive('wordpress')) {
            $outputTarget = 'website';
        }
        if ($outputTarget === 'shopify_theme' && ! app(PluginManager::class)->isActive('shopify')) {
            $outputTarget = 'website';
        }

        // Create template record
        $template = Template::create([
            'slug' => Str::slug($request->name),
            'name' => $request->name,
            'description' => $request->description,
            'thumbnail' => $validated['thumbnail'] ?? null,
            'zip_path' => $zipPath,
            'output_target' => $outputTarget,
            'version' => data_get($metadata, 'version', '1.0.0'),
            'metadata' => $metadata,
        ]);

        // Sync plan assignments
        $template->plans()->sync($request->input('plan_ids', []));

        return redirect()->route('admin.ai-templates')
            ->with('success', __('Template uploaded successfully'));
    }

    /**
     * Update the specified template.
     */
    public function update(Request $request, Template $template): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'thumbnail' => 'nullable|image|max:2048',
            'zip_file' => 'nullable|file|mimes:zip|max:10240',
            'output_target' => 'nullable|string|in:website,wordpress_theme,shopify_theme',
            'plan_ids' => 'nullable|array',
            'plan_ids.*' => 'exists:plans,id',
        ]);

        // Prevent editing system templates
        if ($template->is_system) {
            return redirect()
                ->route('admin.ai-templates')
                ->with('error', __('System templates cannot be modified.'));
        }

        // Handle thumbnail upload
        if ($request->hasFile('thumbnail')) {
            // Delete old thumbnail
            if ($template->thumbnail) {
                Storage::disk('public')->delete($template->thumbnail);
            }
            $validated['thumbnail'] = $request->file('thumbnail')->store('thumbnails', 'public');
        }

        // Handle new zip file
        $metadata = $template->metadata;
        if ($request->hasFile('zip_file')) {
            // Delete old zip file (use raw value since accessor adds full path)
            if ($template->getRawOriginal('zip_path')) {
                Storage::disk('local')->delete($template->getRawOriginal('zip_path'));
            }

            $zipPath = $request->file('zip_file')->store('templates', 'local');

            // Extract metadata from new zip
            $zip = new ZipArchive;
            $fullZipPath = Storage::disk('local')->path($zipPath);
            if ($zip->open($fullZipPath) === true) {
                $jsonContent = $zip->getFromName('template.json');
                if ($jsonContent) {
                    $decoded = json_decode($jsonContent, true);
                    if ($decoded && is_array($decoded)) {
                        $metadata = $decoded;
                    }
                }
                $zip->close();
            }

            $validated['zip_path'] = $zipPath;
        }

        // When the requested target needs a plugin that is not active, fall back to
        // preserving the existing output target — only the specific plugin gate fires,
        // so an admin can still change a website → wordpress_theme while Shopify is off.
        $outputTarget = $validated['output_target'] ?? $template->output_target ?? 'website';
        if ($outputTarget === 'wordpress_theme' && ! app(PluginManager::class)->isActive('wordpress')) {
            $outputTarget = $template->output_target ?? 'website';
        }
        if ($outputTarget === 'shopify_theme' && ! app(PluginManager::class)->isActive('shopify')) {
            $outputTarget = $template->output_target ?? 'website';
        }

        $template->update([
            'name' => $request->name,
            'description' => $request->description,
            'thumbnail' => $validated['thumbnail'] ?? $template->thumbnail,
            'zip_path' => $validated['zip_path'] ?? $template->getRawOriginal('zip_path'),
            'output_target' => $outputTarget,
            'version' => data_get($metadata, 'version', $template->version),
            'metadata' => $metadata,
        ]);

        // Sync plan assignments
        $template->plans()->sync($request->input('plan_ids', []));

        return redirect()->route('admin.ai-templates')
            ->with('success', __('Template updated successfully'));
    }

    /**
     * Remove the specified template.
     */
    public function destroy(Template $template): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        try {
            // Delete zip file (use raw value since accessor adds full path)
            if ($template->getRawOriginal('zip_path')) {
                Storage::disk('local')->delete($template->getRawOriginal('zip_path'));
            }

            // Delete thumbnail
            if ($template->thumbnail) {
                Storage::disk('public')->delete($template->thumbnail);
            }

            $template->delete();

            return redirect()->route('admin.ai-templates')
                ->with('success', __('Template deleted successfully'));
        } catch (\Exception $e) {
            return redirect()
                ->route('admin.ai-templates')
                ->with('error', __('System templates cannot be deleted.'));
        }
    }

    /**
     * Get metadata for a template (JSON response).
     */
    public function metadata(Template $template): JsonResponse
    {
        return response()->json($template->metadata ?? [
            'error' => __('No metadata available'),
        ]);
    }
}
