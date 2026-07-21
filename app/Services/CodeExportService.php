<?php

namespace App\Services;

use App\Models\Project;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use ZipArchive;

/**
 * Builds a downloadable, self-contained, Vercel-ready ZIP of a project's source.
 *
 * Pipeline: fetch the editable source from the builder → apply deploy transforms
 * (vercel.json SPA rewrites, root basename, injected client-safe runtime config,
 * a deploy README) → bundle the stock-library images the app uses into public/ so
 * paths resolve off-platform → re-zip. The result builds with `npm run build`
 * anywhere (Vercel auto-detects Vite) and runs without Webby.
 */
class CodeExportService
{
    /** Match /storage/image-library/... references anywhere in the source. */
    private const IMAGE_REF_RE = '#/storage/image-library/[A-Za-z0-9_\-./]+\.(?:jpe?g|png|webp|gif|svg|avif)#i';

    /**
     * Produce the export zip and return its absolute temp path.
     * Caller is responsible for streaming + deleting it.
     */
    public function export(Project $project): string
    {
        $builder = $project->builder;
        if (! $builder) {
            throw new RuntimeException('Project has no builder — nothing to export.');
        }

        $workspaceId = $project->build_session_id ?: $project->id;

        $work = $this->makeTempDir();
        try {
            $this->fetchAndExtractSource($builder, $workspaceId, $work);

            $this->writeVercelJson($work);
            $this->patchRootBasename($work);
            $this->setDocumentTitle($project, $work);
            $this->injectRuntimeConfig($project, $work);
            $this->bundleImages($work);
            $this->writeReadme($project, $work);
            $this->applyCopyrightMark($project, $work);

            return $this->zipDir($work, $project);
        } finally {
            $this->rrmdir($work);
        }
    }

    private function fetchAndExtractSource($builder, string $workspaceId, string $work): void
    {
        $response = Http::timeout(120)
            ->withHeaders(['X-Server-Key' => $builder->server_key])
            ->get("{$builder->full_url}/api/export-workspace/{$workspaceId}");

        if (! $response->successful()) {
            throw new RuntimeException('Failed to fetch project source: '.mb_substr($response->body(), 0, 200));
        }

        $tmpZip = $work.'/__source.zip';
        file_put_contents($tmpZip, $response->body());

        $zip = new ZipArchive;
        if ($zip->open($tmpZip) !== true) {
            throw new RuntimeException('Could not open source archive from builder.');
        }
        $zip->extractTo($work);
        $zip->close();
        @unlink($tmpZip);

        if (! is_dir($work.'/src')) {
            throw new RuntimeException('Exported source has no src/ directory.');
        }
    }

    /** SPA rewrites so client-side routes resolve; Vercel serves real files first. */
    private function writeVercelJson(string $work): void
    {
        $json = json_encode([
            '$schema' => 'https://openapi.vercel.sh/vercel.json',
            'rewrites' => [
                ['source' => '/(.*)', 'destination' => '/index.html'],
            ],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        file_put_contents($work.'/vercel.json', $json."\n");
    }

    /**
     * The templates derive the router basename from a <base href> Webby injects
     * at preview time, defaulting to '/preview' when absent. A standalone deploy
     * runs at the domain root, so force the basename fallback to '/'.
     */
    private function patchRootBasename(string $work): void
    {
        $main = $work.'/src/main.tsx';
        if (! is_file($main)) {
            return;
        }
        $contents = file_get_contents($main);
        $updated = str_replace("'/preview'", "'/'", $contents);
        if ($updated !== $contents) {
            file_put_contents($main, $updated);
        }
    }

    /** The stock <title> every website template ships with. */
    private const STOCK_TITLE = '<title>Webby Project</title>';

    /**
     * Older workspaces still carry the template's stock <title> (builds that ran
     * before the project name was forwarded to the builder). Rewrite it to the
     * project's real name; a custom title the AI already set is left untouched.
     */
    private function setDocumentTitle(Project $project, string $work): void
    {
        $index = $work.'/index.html';
        $name = trim((string) $project->name);
        if ($name === '' || ! is_file($index)) {
            return;
        }

        $html = file_get_contents($index);
        if (! str_contains($html, self::STOCK_TITLE)) {
            return;
        }
        file_put_contents($index, str_replace(self::STOCK_TITLE, '<title>'.e($name).'</title>', $html));
    }

    /**
     * Inject window.__APP_CONFIG__ into index.html so the deployed app boots with
     * its runtime config (Supabase url + publishable key + schema — NEVER the
     * secret key). Mirrors the preview injection; runs before the app bundle.
     */
    private function injectRuntimeConfig(Project $project, string $work): void
    {
        $index = $work.'/index.html';
        if (! is_file($index)) {
            return;
        }

        $config = [
            'apiUrl' => config('app.url'),
            'projectId' => $project->id,
            'apiToken' => $project->api_token,
        ];

        $plan = $project->user?->getCurrentPlan();
        $supabase = app(SupabaseService::class);
        if (($plan?->databaseEnabled() ?? false) && $supabase->hasConnection($project)) {
            $sb = $supabase->resolveForProject($project);
            $config['supabase'] = [
                'url' => $sb['url'],
                'publishableKey' => $sb['publishable_key'],
                'schema' => $sb['schema'],
            ];
        }

        // JSON_HEX_TAG (+ AMP/APOS/QUOT) hex-escape <, >, &, ', " so a user-controlled
        // BYOD value (e.g. a Supabase url/key containing "</script>") can never break
        // out of this inline <script> block. Mirrors BuilderService::injectAppConfig.
        $script = '<script>window.__APP_CONFIG__ = '.json_encode($config, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT).';</script>';
        $html = file_get_contents($index);

        if (str_contains($html, '__APP_CONFIG__')) {
            return; // already present
        }
        if (str_contains($html, '</head>')) {
            $html = str_replace('</head>', "    {$script}\n  </head>", $html);
        } else {
            $html = $script."\n".$html;
        }
        file_put_contents($index, $html);
    }

    /**
     * Copy every stock-library image the source references into public/ so the
     * paths (/storage/image-library/...) resolve on any host — no platform
     * coupling. Vite copies public/ to the build output root.
     */
    private function bundleImages(string $work): void
    {
        $refs = [];
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($work, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($it as $file) {
            if ($file->isDir()) {
                continue;
            }
            $ext = strtolower($file->getExtension());
            if (! in_array($ext, ['tsx', 'ts', 'jsx', 'js', 'css', 'html', 'json'], true)) {
                continue;
            }
            if (preg_match_all(self::IMAGE_REF_RE, file_get_contents($file->getPathname()), $m)) {
                foreach ($m[0] as $ref) {
                    $refs[$ref] = true;
                }
            }
        }

        $libBase = storage_path('app/public/image-library');
        foreach (array_keys($refs) as $ref) {
            // ref: /storage/image-library/gallery/x.jpeg
            $rel = ltrim(substr($ref, strlen('/storage/image-library/')), '/');
            $rel = str_replace('..', '', $rel); // path-traversal guard
            $srcFile = $libBase.'/'.$rel;
            if (! is_file($srcFile)) {
                continue;
            }
            $dest = $work.'/public/storage/image-library/'.$rel;
            $dir = dirname($dest);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            @copy($srcFile, $dest);
        }
    }

    private function writeReadme(Project $project, string $work): void
    {
        $name = $project->name ?: 'Your Webby project';
        $md = <<<MD
# {$name}

Exported from Webby. A React + Vite + Tailwind + shadcn/ui single-page app.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
```

## Deploy to Vercel
1. Push this folder to a Git repo (GitHub/GitLab/Bitbucket).
2. Import it in Vercel — it auto-detects **Vite** (build `npm run build`, output `dist`).
3. The included `vercel.json` handles single-page-app routing.

No environment variables are required: the app's runtime config (including the
Supabase URL + public key) is embedded in `index.html` as `window.__APP_CONFIG__`,
and the stock images it uses are bundled under `public/storage/`.

> To point the app at **your own** Supabase project, edit `window.__APP_CONFIG__`
> in `index.html` (only the public *publishable* key is included — never a secret).

> ⚠️ **Security:** `index.html` contains a live API token scoped to this project's
> file storage. Do **not** commit this folder to a public repository as-is —
> regenerate the project's API token in your dashboard first if you intend to
> publish the source publicly.
MD;
        file_put_contents($work.'/README.md', $md."\n");
    }

    /**
     * Plan-gated copyright mark: visible badge + source comment banner for
     * non-white-label plans. No-op when the owner's plan has White Label.
     * Runs last so the README (written above) gets its attribution line too.
     */
    private function applyCopyrightMark(Project $project, string $work): void
    {
        $service = app(CopyrightMarkService::class);
        $mark = $service->markFor($project);
        if ($mark === null) {
            return;
        }

        $index = $work.'/index.html';
        if (is_file($index)) {
            $html = $service->injectHtml(file_get_contents($index), $mark);
            file_put_contents($index, $service->prependComment($html, $mark));
        }

        $readme = $work.'/README.md';
        if (is_file($readme)) {
            file_put_contents($readme, rtrim(file_get_contents($readme))."\n\n---\n\n{$mark['comment']}\n");
        }
    }

    private function zipDir(string $work, Project $project): string
    {
        $out = $this->makeTempDir().'/export.zip';
        $zip = new ZipArchive;
        if ($zip->open($out, ZipArchive::CREATE) !== true) {
            throw new RuntimeException('Could not create export zip.');
        }
        $it = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($work, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $file) {
            $local = ltrim(str_replace($work, '', $file->getPathname()), '/');
            if ($file->isDir()) {
                $zip->addEmptyDir($local);
            } else {
                $zip->addFile($file->getPathname(), $local);
            }
        }
        $zip->close();

        return $out;
    }

    private function makeTempDir(): string
    {
        $dir = sys_get_temp_dir().'/webby_export_'.uniqid();
        mkdir($dir, 0755, true);

        return $dir;
    }

    private function rrmdir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($dir);
    }
}
