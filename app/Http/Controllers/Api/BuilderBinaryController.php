<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BuilderBinaryController extends Controller
{
    private const MAP = [
        'linux|amd64' => 'webby-builder-linux',
        'linux|arm64' => 'webby-builder-arm64',
        'darwin|arm64' => 'webby-builder-macos',
    ];

    public function serve(Request $request): BinaryFileResponse|JsonResponse
    {
        $os = (string) $request->query('os');
        $arch = (string) $request->query('arch');
        $file = self::MAP[$os.'|'.$arch] ?? null;
        if ($file === null) {
            return response()->json(['error' => 'Unsupported platform.'], 404);
        }

        $path = storage_path('app/updates/builder/'.$file);
        if (! is_file($path)) {
            return response()->json(['error' => 'Builder binary not staged.'], 404);
        }

        $digest = base64_encode(hash_file('sha256', $path, true));

        return response()->download($path, $file, [
            'Content-Type' => 'application/octet-stream',
            'Digest' => 'sha-256='.$digest,
        ]);
    }
}
