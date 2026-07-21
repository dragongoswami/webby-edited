<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class BuilderPromptsController extends Controller
{
    /**
     * Stream a zip of the staged builder prompts (Builder/prebuilt/prompts/**),
     * with a Digest: sha-256 header over the zip bytes, for a builder to mirror
     * during self-update. The zip stores entries relative to the prompts dir
     * (system.md, compact-shopify.md, …). 404 when nothing is staged.
     */
    public function serve(): BinaryFileResponse|JsonResponse
    {
        $dir = storage_path('app/updates/builder/prompts');
        if (! is_dir($dir) || $this->isEmpty($dir)) {
            return response()->json(['error' => 'Builder prompts not staged.'], 404);
        }

        // tempnam() creates the file; ZipArchive overwrites it in place (no .zip
        // suffix, so there is no orphan placeholder to leak).
        $tmp = tempnam(sys_get_temp_dir(), 'wbprompts');
        try {
            $this->zipDir($dir, $tmp);
        } catch (\Throwable $e) {
            @unlink($tmp);
            throw $e;
        }

        $digest = base64_encode(hash_file('sha256', $tmp, true));

        return response()->download($tmp, 'prompts.zip', [
            'Content-Type' => 'application/zip',
            'Digest' => 'sha-256='.$digest,
        ])->deleteFileAfterSend(true);
    }

    private function isEmpty(string $dir): bool
    {
        foreach (new \FilesystemIterator($dir) as $_) {
            return false;
        }

        return true;
    }

    private function zipDir(string $dir, string $zipPath): void
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Cannot create prompts zip.');
        }

        $base = rtrim($dir, '/').'/';
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );
        // Deterministic order so the Digest is stable across requests.
        $paths = [];
        foreach ($items as $item) {
            if ($item->isFile()) {
                $paths[] = $item->getPathname();
            }
        }
        sort($paths);
        foreach ($paths as $path) {
            $zip->addFile($path, substr($path, strlen($base)));
        }
        $zip->close();
    }
}
