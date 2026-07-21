<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Traits\ChecksDemoMode;
use App\Models\DesignSystem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use ZipArchive;

/**
 * Admin CRUD for installable design systems. Mirrors {@see AdminTemplateController}:
 * a design system is a zip (tokens.css + accents.json + fonts.html + DESIGN.md +
 * design.json) uploaded here and overlaid onto templates by the Go builder.
 */
class AdminDesignSystemController extends Controller
{
    use ChecksDemoMode;

    /** A valid design-system zip must contain these entries. */
    private const REQUIRED_ENTRIES = ['design.json', 'tokens.css', 'accents.json'];

    public function index(Request $request): Response
    {
        $designSystems = DesignSystem::query()
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->paginate($request->input('per_page', 10))
            ->through(fn (DesignSystem $s) => array_merge($s->toArray(), [
                'has_preview' => $s->hasPreview(),
            ]));

        return Inertia::render('Admin/DesignSystems/Index', [
            'designSystems' => $designSystems,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'when_to_use' => 'nullable|string',
            'zip_file' => 'required|file|mimes:zip|max:10240',
            'is_default' => 'boolean',
        ]);

        $zipPath = $request->file('zip_file')->store('design-systems', 'local');
        if (! $this->zipHasRequiredEntries($zipPath)) {
            Storage::disk('local')->delete($zipPath);

            return back()->withErrors([
                'zip_file' => __('Invalid design system zip. It must contain design.json, tokens.css, and accents.json.'),
            ]);
        }

        $manifest = $this->readManifest($zipPath);

        $system = DesignSystem::create([
            'slug' => $this->uniqueSlug($manifest['slug'] ?? $request->name),
            'name' => $request->name,
            'description' => $request->description,
            'when_to_use' => $request->when_to_use ?? ($manifest['when_to_use'] ?? null),
            'zip_path' => $zipPath,
            'version' => $manifest['version'] ?? '1.0.0',
            'author' => $manifest['author'] ?? null,
            'is_default' => $request->boolean('is_default'),
            'status' => 'active',
        ]);

        $this->enforceSingleDefault($system);

        return redirect()->route('admin.design-systems')
            ->with('success', __('Design system uploaded successfully'));
    }

    public function update(Request $request, DesignSystem $designSystem): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'when_to_use' => 'nullable|string',
            'zip_file' => 'nullable|file|mimes:zip|max:10240',
            'is_default' => 'boolean',
            'status' => 'nullable|in:active,inactive',
        ]);

        $attributes = [
            'name' => $request->name,
            'description' => $request->description,
            'when_to_use' => $request->when_to_use,
            'is_default' => $request->boolean('is_default'),
            'status' => $request->input('status', $designSystem->status),
        ];

        if ($request->hasFile('zip_file')) {
            $newZipPath = $request->file('zip_file')->store('design-systems', 'local');
            if (! $this->zipHasRequiredEntries($newZipPath)) {
                Storage::disk('local')->delete($newZipPath);

                return back()->withErrors([
                    'zip_file' => __('Invalid design system zip. It must contain design.json, tokens.css, and accents.json.'),
                ]);
            }

            if ($designSystem->getRawOriginal('zip_path')) {
                Storage::disk('local')->delete($designSystem->getRawOriginal('zip_path'));
            }

            $manifest = $this->readManifest($newZipPath);
            $attributes['zip_path'] = $newZipPath;
            $attributes['version'] = $manifest['version'] ?? $designSystem->version;
            $attributes['author'] = $manifest['author'] ?? $designSystem->author;
        }

        $designSystem->update($attributes);
        $this->enforceSingleDefault($designSystem);

        return redirect()->route('admin.design-systems')
            ->with('success', __('Design system updated successfully'));
    }

    public function destroy(DesignSystem $designSystem): RedirectResponse
    {
        if ($redirect = $this->denyIfDemo()) {
            return $redirect;
        }

        if ($designSystem->is_default) {
            return redirect()->route('admin.design-systems')
                ->with('error', __('The default design system cannot be deleted. Set another as default first.'));
        }

        if ($designSystem->getRawOriginal('zip_path')) {
            Storage::disk('local')->delete($designSystem->getRawOriginal('zip_path'));
        }

        $designSystem->delete();

        return redirect()->route('admin.design-systems')
            ->with('success', __('Design system deleted successfully'));
    }

    /** Confirm the uploaded zip is a usable design system before persisting it. */
    private function zipHasRequiredEntries(string $relativePath): bool
    {
        $zip = new ZipArchive;
        if ($zip->open(Storage::disk('local')->path($relativePath)) !== true) {
            return false;
        }

        $ok = true;
        foreach (self::REQUIRED_ENTRIES as $entry) {
            if ($zip->locateName($entry) === false) {
                $ok = false;
                break;
            }
        }
        $zip->close();

        return $ok;
    }

    /** @return array<string,mixed> */
    private function readManifest(string $relativePath): array
    {
        $zip = new ZipArchive;
        if ($zip->open(Storage::disk('local')->path($relativePath)) !== true) {
            return [];
        }
        $raw = $zip->getFromName('design.json');
        $zip->close();

        return $raw === false ? [] : (json_decode($raw, true) ?: []);
    }

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'design-system';
        $slug = $base;
        $i = 2;
        while (DesignSystem::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }

    /** Keep at most one default system: clear the flag on every other record. */
    private function enforceSingleDefault(DesignSystem $system): void
    {
        if (! $system->is_default) {
            return;
        }
        DesignSystem::where('id', '!=', $system->id)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }
}
