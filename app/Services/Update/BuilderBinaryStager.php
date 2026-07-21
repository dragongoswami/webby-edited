<?php

namespace App\Services\Update;

use RuntimeException;
use ZipArchive;

class BuilderBinaryStager
{
    private const BINARIES = ['webby-builder-linux', 'webby-builder-arm64', 'webby-builder-macos'];

    /**
     * Extract the three Builder/prebuilt/webby-builder-* binaries from a release
     * zip into $destDir (replacing any prior set). Returns the names staged.
     *
     * @return string[]
     */
    public function stage(string $zipPath, string $destDir): array
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new RuntimeException('Cannot open release archive for builder staging.');
        }
        if (! is_dir($destDir)) {
            mkdir($destDir, 0775, true);
        }

        $staged = [];
        foreach (self::BINARIES as $name) {
            $entry = 'Builder/prebuilt/'.$name;
            if ($zip->locateName($entry) === false) {
                continue;
            }
            $in = $zip->getStream($entry);
            try {
                $dest = rtrim($destDir, '/').'/'.$name;
                $out = fopen($dest, 'wb');
                if ($out === false) {
                    throw new RuntimeException("Cannot write builder binary to {$dest}");
                }
                stream_copy_to_stream($in, $out);
                fclose($out);
            } finally {
                fclose($in);
            }
            chmod($dest, 0755);
            $staged[] = $name;
        }
        $zip->close();

        return $staged;
    }
}
