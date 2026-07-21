<?php

namespace App\Services\Update;

use RuntimeException;
use ZipArchive;

class ReleaseArchive
{
    public function __construct(private string $zipPath) {}

    /**
     * Extract only the Install/ subtree onto $target, honoring a skip-list of
     * target-relative path prefixes. Overlay-merge: never deletes existing files.
     *
     * @param  string[]  $skip  target-relative prefixes to never write (e.g. 'storage/', '.env')
     */
    public function extractTo(string $target, array $skip): void
    {
        $zip = new ZipArchive;
        if ($zip->open($this->zipPath) !== true) {
            throw new RuntimeException('Cannot open update archive.');
        }

        $hasInstall = false;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            if (str_starts_with($zip->getNameIndex($i), 'Install/')) {
                $hasInstall = true;
                break;
            }
        }
        if (! $hasInstall) {
            $zip->close();
            throw new RuntimeException('Archive has no Install/ root; not a valid release.zip.');
        }

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (! str_starts_with($name, 'Install/')) {
                continue;
            }
            $rel = substr($name, strlen('Install/'));
            if ($rel === '' || str_ends_with($name, '/')) {
                continue;
            }
            // Reject only genuine path traversal — a literal ".." path *segment*
            // or an absolute path. A ".." appearing *inside* a filename (e.g. a git
            // range like "review-7622914b..f014dd5e.diff") is legitimate and must
            // not abort the update.
            $segments = preg_split('#[/\\\\]#', $rel);
            if (str_starts_with($rel, '/') || str_starts_with($rel, '\\') || in_array('..', $segments, true)) {
                $zip->close();
                throw new RuntimeException("Zip entry escapes target: {$rel}");
            }
            foreach ($skip as $prefix) {
                if ($rel === rtrim($prefix, '/') || str_starts_with($rel, $prefix)) {
                    continue 2;
                }
            }
            $dest = rtrim($target, '/').'/'.$rel;
            $dir = dirname($dest);
            if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
                $zip->close();
                throw new RuntimeException("Cannot create directory {$dir} during update — check filesystem permissions and available disk space.");
            }
            $stream = $zip->getStream($name);
            if ($stream === false) {
                $zip->close();
                throw new RuntimeException("Cannot read '{$name}' from the update archive.");
            }
            $out = @fopen($dest, 'wb');
            if ($out === false) {
                fclose($stream);
                $zip->close();
                throw new RuntimeException("Cannot write to {$dest} during update — check filesystem permissions and available disk space.");
            }
            stream_copy_to_stream($stream, $out);
            fclose($out);
            fclose($stream);
        }
        $zip->close();
    }
}
