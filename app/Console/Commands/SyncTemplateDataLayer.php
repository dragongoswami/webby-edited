<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Str;
use RuntimeException;
use ZipArchive;

class SyncTemplateDataLayer extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'templates:sync-data-layer {--path= : Override the templates directory (defaults to storage/app/private/templates)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Overlay the canonical Supabase data layer onto every template zip and strip the legacy Firebase layer.';

    /**
     * Canonical files (relative to templates/shared-data-layer/src) overlaid
     * onto each template's src/. types.ts is included because supabase.ts and
     * useAuth.ts import from '../types'.
     *
     * @var array<int,string>
     */
    protected array $canonicalFiles = [
        'types.ts',
        'vite-env.d.ts',
        'lib/supabase.ts',
        'hooks/useSupabaseTable.ts',
        'hooks/useData.ts',
        'hooks/useAuth.ts',
        'hooks/useSystemStorage.ts',
        'components/ProtectedRoute.tsx',
    ];

    /**
     * src/ files removed from each template.
     *
     * @var array<int,string>
     */
    protected array $deleteFromSrc = [
        'lib/firebase.ts',
        'hooks/useFirestore.ts',
    ];

    public function handle(): int
    {
        $templatesDir = $this->option('path') ?: storage_path('app/private/templates');

        if (! is_dir($templatesDir)) {
            $this->error("Templates directory not found: {$templatesDir}");

            return self::FAILURE;
        }

        $canonicalDir = base_path('templates/shared-data-layer/src');

        if (! is_dir($canonicalDir)) {
            $this->error("Canonical data layer not found: {$canonicalDir}");

            return self::FAILURE;
        }

        $zips = glob(rtrim($templatesDir, '/').'/*.zip') ?: [];

        if (empty($zips)) {
            $this->warn("No template zips found in: {$templatesDir}");

            return self::SUCCESS;
        }

        foreach ($zips as $zipPath) {
            try {
                $this->syncZip($zipPath, $canonicalDir);
                $this->info('Synced: '.basename($zipPath));
            } catch (RuntimeException $e) {
                $this->error('Failed: '.basename($zipPath).' — '.$e->getMessage());

                return self::FAILURE;
            }
        }

        $this->info('All templates synced.');

        return self::SUCCESS;
    }

    /**
     * Sync a single template zip in place.
     */
    protected function syncZip(string $zipPath, string $canonicalDir): void
    {
        $work = $this->makeTempDir();

        try {
            $this->extract($zipPath, $work);

            $src = $work.'/src';
            if (! is_dir($src)) {
                throw new RuntimeException('template has no src/ directory');
            }

            $this->overlayCanonical($canonicalDir, $src);
            $this->deleteLegacy($work, $src);
            $this->patchEntryTsx($src, 'main.tsx');
            $this->patchEntryTsx($src, 'App.tsx');
            $this->patchHooksIndex($src);
            $this->patchPackageJson($work);
            $this->patchKnowledge($work);
            $this->grepGuard($src);
            $this->rezip($zipPath, $work);
        } finally {
            $this->rrmdir($work);
        }
    }

    /**
     * Copy canonical files into the template src/, mirroring the path layout.
     */
    protected function overlayCanonical(string $canonicalDir, string $src): void
    {
        foreach ($this->canonicalFiles as $rel) {
            $from = $canonicalDir.'/'.$rel;
            if (! is_file($from)) {
                throw new RuntimeException("canonical file missing: {$rel}");
            }
            $to = $src.'/'.$rel;
            $dir = dirname($to);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            if (! copy($from, $to)) {
                throw new RuntimeException("could not copy canonical file: {$rel}");
            }
        }
    }

    /**
     * Delete the legacy Firebase files and the lockfile (idempotent).
     */
    protected function deleteLegacy(string $work, string $src): void
    {
        foreach ($this->deleteFromSrc as $rel) {
            $path = $src.'/'.$rel;
            if (is_file($path)) {
                unlink($path);
            }
        }

        $lock = $work.'/package-lock.json';
        if (is_file($lock)) {
            unlink($lock);
        }
    }

    /**
     * Rewrite the Firebase data-layer wiring in an entry file (main.tsx /
     * App.tsx): initFirebase -> initSupabase, the './lib/firebase' import path
     * -> './lib/supabase', and the __APP_CONFIG__?.firebase guard ->
     * __APP_CONFIG__?.supabase. Idempotent: a no-op when nothing matches.
     */
    protected function patchEntryTsx(string $src, string $file): void
    {
        $path = $src.'/'.$file;
        if (! is_file($path)) {
            return;
        }

        $contents = file_get_contents($path);
        $updated = str_replace('initFirebase', 'initSupabase', $contents);
        $updated = str_replace("from './lib/firebase'", "from './lib/supabase'", $updated);
        $updated = str_replace('from "./lib/firebase"', 'from "./lib/supabase"', $updated);
        $updated = str_replace('__APP_CONFIG__?.firebase', '__APP_CONFIG__?.supabase', $updated);

        if ($updated !== $contents) {
            file_put_contents($path, $updated);
        }
    }

    /**
     * Swap the legacy useFirestore exports in src/hooks/index.ts for the
     * canonical useSupabaseTable equivalents. Idempotent.
     */
    protected function patchHooksIndex(string $src): void
    {
        $path = $src.'/hooks/index.ts';
        if (! is_file($path)) {
            return;
        }

        $contents = file_get_contents($path);
        $updated = str_replace(
            [
                "export { useFirestore } from './useFirestore';",
                "export type { UseFirestoreOptions } from './useFirestore';",
            ],
            [
                "export { useSupabaseTable } from './useSupabaseTable';",
                "export type { UseSupabaseTableOptions } from './useSupabaseTable';",
            ],
            $contents
        );

        if ($updated !== $contents) {
            file_put_contents($path, $updated);
        }
    }

    /**
     * Remove the firebase dependency and ensure @supabase/supabase-js is present.
     */
    protected function patchPackageJson(string $work): void
    {
        $path = $work.'/package.json';
        if (! is_file($path)) {
            return;
        }

        $pkg = json_decode(file_get_contents($path), true);
        if (! is_array($pkg)) {
            throw new RuntimeException('package.json is not valid JSON');
        }

        if (isset($pkg['dependencies']) && is_array($pkg['dependencies'])) {
            unset($pkg['dependencies']['firebase']);
            $pkg['dependencies']['@supabase/supabase-js'] = '^2.45.0';
        } else {
            $pkg['dependencies'] = ['@supabase/supabase-js' => '^2.45.0'];
        }

        $json = json_encode($pkg, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
        file_put_contents($path, $json);
    }

    /**
     * Rewrite Firebase wording in KNOWLEDGE.md (case-aware).
     */
    protected function patchKnowledge(string $work): void
    {
        $path = $work.'/KNOWLEDGE.md';
        if (! is_file($path)) {
            return;
        }

        $contents = file_get_contents($path);
        $updated = str_replace(
            ['Firestore', 'Firebase', 'firebase'],
            ['Supabase', 'Supabase', 'supabase'],
            $contents
        );

        if ($updated !== $contents) {
            file_put_contents($path, $updated);
        }
    }

    /**
     * Fail if any src/ file still references the Firebase data layer.
     */
    protected function grepGuard(string $src): void
    {
        $needles = ['lib/firebase', 'useFirestore', "from 'firebase", 'from "firebase'];

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($src, \FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if (! $file->isFile()) {
                continue;
            }
            $contents = file_get_contents($file->getPathname());
            foreach ($needles as $needle) {
                if (Str::contains($contents, $needle)) {
                    $rel = ltrim(Str::after($file->getPathname(), $src), '/');
                    throw new RuntimeException("residual Firebase reference '{$needle}' in src/{$rel}");
                }
            }
        }
    }

    /**
     * Re-zip the working dir back into the original zip path, preserving the
     * internal layout (files relative to the working dir root).
     */
    protected function rezip(string $zipPath, string $work): void
    {
        if (is_file($zipPath)) {
            unlink($zipPath);
        }

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE) !== true) {
            throw new RuntimeException("could not create zip: {$zipPath}");
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($work, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            $local = ltrim(Str::after($file->getPathname(), $work), '/');
            if ($file->isDir()) {
                $zip->addEmptyDir($local);
            } else {
                $zip->addFile($file->getPathname(), $local);
            }
        }

        $zip->close();
    }

    /**
     * Extract a zip into a directory.
     */
    protected function extract(string $zipPath, string $dest): void
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new RuntimeException("could not open zip: {$zipPath}");
        }
        $zip->extractTo($dest);
        $zip->close();
    }

    protected function makeTempDir(): string
    {
        $dir = sys_get_temp_dir().'/tpl_sync_'.uniqid();
        mkdir($dir, 0755, true);

        return $dir;
    }

    protected function rrmdir(string $dir): void
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
