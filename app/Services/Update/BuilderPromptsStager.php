<?php

namespace App\Services\Update;

use Illuminate\Support\Facades\Log;
use RuntimeException;
use ZipArchive;

class BuilderPromptsStager
{
    private const PREFIX = 'Builder/prebuilt/prompts/';

    /**
     * Extract every Builder/prebuilt/prompts/** entry from a release zip into
     * $destDir, preserving paths relative to the prompts dir (e.g. system.md).
     * The destination is fully cleared first so prompts removed/renamed in the
     * release do not linger. Returns the relative paths staged.
     *
     * @return string[]
     */
    public function stage(string $zipPath, string $destDir): array
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new RuntimeException('Cannot open release archive for prompts staging.');
        }

        $this->clear($destDir);
        if (! is_dir($destDir)) {
            mkdir($destDir, 0775, true);
        }

        $staged = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if ($name === false || ! str_starts_with($name, self::PREFIX)) {
                continue;
            }
            $rel = substr($name, strlen(self::PREFIX));
            if ($rel === '' || str_ends_with($rel, '/')) {
                continue; // directory entry
            }
            // Defence-in-depth against zip traversal in a trusted artifact.
            // Match real traversal only — a literal ".." path *segment* or an
            // absolute path — so a ".." inside a filename isn't wrongly skipped.
            $segments = preg_split('#[/\\\\]#', $rel);
            if (str_starts_with($rel, '/') || str_starts_with($rel, '\\') || in_array('..', $segments, true)) {
                Log::warning('BuilderPromptsStager: skipped suspicious zip entry', ['entry' => $rel]);

                continue;
            }

            $dest = rtrim($destDir, '/').'/'.$rel;
            $parent = dirname($dest);
            if (! is_dir($parent)) {
                mkdir($parent, 0775, true);
            }

            $in = $zip->getStream($name);
            try {
                $out = fopen($dest, 'wb');
                if ($out === false) {
                    throw new RuntimeException("Cannot write prompt to {$dest}");
                }
                stream_copy_to_stream($in, $out);
                fclose($out);
            } finally {
                fclose($in);
            }
            $staged[] = $rel;
        }
        $zip->close();

        return $staged;
    }

    private function clear(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
    }
}
