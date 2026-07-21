<?php

namespace App\Services;

use App\Models\DesignSystem;
use App\Models\Project;
use Illuminate\Support\Facades\Log;
use ZipArchive;

/**
 * Resolves a project's design system + chosen accent into the inline payload the
 * Go builder overlays onto the template at build time (tokens + accent maps +
 * fonts + playbook + optional component overrides).
 */
class DesignSystemService
{
    /** Component files larger than this (or beyond this count) are skipped to bound payload size. */
    private const MAX_COMPONENT_BYTES = 64 * 1024;

    private const MAX_COMPONENTS = 30;

    /**
     * Build the inline `design_system` payload for a project, or null when no
     * system resolves (no default installed).
     */
    public function buildPayload(Project $project): ?array
    {
        $system = $project->designSystem ?: DesignSystem::default()->active()->first();
        if (! $system || ! $system->zip_path || ! is_file($system->zip_path)) {
            return null;
        }

        $accentName = $project->design_accent ?: ($system->manifest()['default_accent'] ?? null);
        $accent = $system->resolveAccent($accentName);
        $assets = $this->readAssets($system);

        $payload = [
            'slug' => $system->slug,
            'tokens' => $assets['tokens'],
            'fonts' => $assets['fonts'],
            'playbook' => $assets['playbook'],
            'accent' => $accentName,
            // Every map below must serialize as JSON `{}` (not `[]`) when empty to
            // match the Go `map[string]string` fields — `ShouldBindJSON` returns
            // HTTP 400 ("cannot unmarshal array into … map") otherwise, silently
            // aborting the build/re-theme. A third-party zip with a sparse accent
            // (missing light/dark) is enough to trigger it.
            'accent_light' => $this->asObject($accent['light'] ?? []),
            'accent_dark' => $this->asObject($accent['dark'] ?? []),
            'components' => $this->asObject($assets['components']),
        ];

        // WordPress builds get the full accent catalog so the builder can emit
        // styles/*.json Site Editor style variations (one per accent + dark).
        if ($project->isWordPressTheme()) {
            $payload['accents'] = $this->allAccents($system);
        }

        return $payload;
    }

    /** Empty maps must encode as JSON `{}` for Go's map[string]string fields. */
    private function asObject(array $map): array|\stdClass
    {
        return $map === [] ? new \stdClass : $map;
    }

    /**
     * Every accent's light/dark maps, keyed by accent name. Empty maps must
     * encode as `{}` (not `[]`) for the Go map[string]string fields.
     */
    private function allAccents(DesignSystem $system): array|\stdClass
    {
        $out = [];
        foreach ($system->accents() as $name) {
            $accent = $system->resolveAccent($name);
            $out[$name] = [
                'light' => $this->asObject($accent['light'] ?? []),
                'dark' => $this->asObject($accent['dark'] ?? []),
            ];
        }

        return $this->asObject($out);
    }

    /**
     * Build the catalog the LLM selector ranks over: every active system with
     * its accent names. Default system first so it wins ties / fallbacks.
     *
     * @return array<int,array{id:int,slug:string,name:string,when_to_use:string,accents:array<int,string>,has_preview:bool}>
     */
    public function selectorCatalog(): array
    {
        return DesignSystem::query()->active()->orderByDesc('is_default')->orderBy('name')->get()
            ->map(fn (DesignSystem $s) => [
                'id' => $s->id,
                'slug' => $s->slug,
                'name' => $s->name,
                'when_to_use' => (string) ($s->when_to_use ?? ''),
                'accents' => $s->accents(),
                'has_preview' => $s->hasPreview(),
            ])->all();
    }

    /**
     * UI-facing list of installable systems for the Create + Settings pickers
     * (includes preview/description; excludes the agent playbook + token bytes).
     *
     * @return array<int,array{id:int,slug:string,name:string,description:?string,is_default:bool,accents:array<int,string>,has_preview:bool}>
     */
    public function publicCatalog(): array
    {
        return DesignSystem::query()->active()->orderByDesc('is_default')->orderBy('name')->get()
            ->map(fn (DesignSystem $s) => [
                'id' => $s->id,
                'slug' => $s->slug,
                'name' => $s->name,
                'description' => $s->description,
                'is_default' => $s->is_default,
                'accents' => $s->accents(),
                'has_preview' => $s->hasPreview(),
            ])->all();
    }

    /**
     * Lazily resolve an Automatic project's design system on first build: when no
     * system is chosen yet (design_system_id null), run the LLM selector over the
     * active catalog — falling back to the default system — and persist the choice
     * so it stays stable across rebuilds and renders correctly in project settings.
     */
    public function ensureResolved(Project $project): void
    {
        if ($project->design_system_id !== null) {
            return; // explicit user choice already made
        }

        $catalog = $this->selectorCatalog();
        if ($catalog === []) {
            return; // nothing installed; buildPayload() falls back (also null)
        }

        $prompt = trim((string) ($project->initial_prompt ?: $project->name));
        $choice = $prompt !== ''
            ? app(InternalAiService::class)->selectDesignSystem($prompt, $catalog)
            : null;

        $picked = null;
        $accent = $choice['accent'] ?? null;
        if ($choice) {
            $picked = collect($catalog)->firstWhere('slug', $choice['slug']);
        }
        if (! $picked) {
            $defaultId = DesignSystem::query()->active()->default()->value('id');
            $picked = collect($catalog)->firstWhere('id', $defaultId) ?: $catalog[0];
            $accent = null; // selector pick was unusable; the default uses its own accent
        }

        // Persist race-safely and converge the in-memory model onto whatever is
        // stored, so the chosen system stays stable across rebuilds and two
        // concurrent builds can never diverge onto different systems.
        try {
            // Atomic + idempotent: only the first build to resolve writes the
            // choice; a concurrent build finds a non-null value and adopts it.
            Project::query()
                ->whereKey($project->getKey())
                ->whereNull('design_system_id')
                ->update([
                    'design_system_id' => $picked['id'],
                    'design_accent' => $accent,
                ]);

            // Re-read the now-persisted values (ours, or a concurrent winner's)
            // and use them for this build — without disturbing other unsaved
            // attributes on the in-memory model.
            $stored = Project::query()
                ->whereKey($project->getKey())
                ->first(['design_system_id', 'design_accent']);

            if (! $stored || $stored->design_system_id === null) {
                throw new \RuntimeException('design system choice did not persist');
            }

            $project->setAttribute('design_system_id', $stored->design_system_id);
            $project->setAttribute('design_accent', $stored->design_accent);
            $project->unsetRelation('designSystem');
        } catch (\Throwable $e) {
            Log::warning('ensureResolved: could not persist design system choice', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);

            // Persistence is unavailable: pin this build to the deterministic
            // default system (not a fresh selector pick) so repeated unpersisted
            // builds all render the same look instead of drifting as the catalog
            // changes. buildPayload() applies its own default if even this fails.
            try {
                $defaultId = DesignSystem::query()->active()->default()->value('id');
            } catch (\Throwable) {
                $defaultId = null;
            }
            $project->setAttribute('design_system_id', $defaultId ?: $picked['id']);
            $project->setAttribute('design_accent', null);
            $project->unsetRelation('designSystem');
        }
    }

    /** Read tokens.css / fonts.html / DESIGN.md and any components/* from the zip. */
    private function readAssets(DesignSystem $system): array
    {
        $out = ['tokens' => '', 'fonts' => '', 'playbook' => '', 'components' => []];

        $zip = new ZipArchive;
        if ($zip->open($system->zip_path) !== true) {
            return $out;
        }

        $out['tokens'] = $this->str($zip->getFromName('tokens.css'));
        $out['fonts'] = $this->str($zip->getFromName('fonts.html'));
        $out['playbook'] = $this->str($zip->getFromName('DESIGN.md'));

        $count = 0;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            // Confine to components/ and reject any traversal segment so a crafted
            // zip can't steer the builder into writing outside src/components/.
            if (! str_starts_with($name, 'components/') || str_ends_with($name, '/') || str_contains($name, '..')) {
                continue;
            }
            $stat = $zip->statIndex($i);
            if ($stat['size'] > self::MAX_COMPONENT_BYTES || $count >= self::MAX_COMPONENTS) {
                continue;
            }
            // Stored as workspace-relative under src/ — strip nothing; the builder
            // writes components/* under src/.
            $out['components'][$name] = $this->str($zip->getFromName($name));
            $count++;
        }

        $zip->close();

        return $out;
    }

    private function str($v): string
    {
        return $v === false ? '' : $v;
    }
}
