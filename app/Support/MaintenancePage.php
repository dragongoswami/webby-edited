<?php

namespace App\Support;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Storage;

class MaintenancePage
{
    /**
     * Branding + copy for the auto-update maintenance page, fully resolved at
     * render time (down --render) so the served 503 is self-contained and needs
     * no app boot, DB, or asset request while the file swap is in progress.
     *
     * @return array{siteName:string,message:string,retry:int,logo:?string,favicon:?string}
     */
    public static function data(): array
    {
        // Wrap all DB-backed reads so a 503 caused by the database being
        // unreachable does not itself throw — the page must always render.
        try {
            $name = (string) (SystemSetting::get('site_name') ?: config('app.name'));
            $custom = trim((string) SystemSetting::get('maintenance_message', ''));
            $retry = (int) SystemSetting::get('maintenance_retry', 60);
            $logo = self::asset((string) SystemSetting::get('site_logo', ''));
            $favicon = self::asset((string) SystemSetting::get('site_favicon', ''));
        } catch (\Throwable) {
            $name = (string) config('app.name');
            $custom = '';
            $retry = 60;
            $logo = null;
            $favicon = null;
        }

        return [
            'siteName' => $name,
            'message' => $custom !== '' ? $custom : "{$name} is being updated — we'll be back shortly.",
            'retry' => max(5, $retry ?: 60),
            'logo' => $logo,
            'favicon' => $favicon,
        ];
    }

    /**
     * Resolve a stored public-disk asset path to a self-contained data: URI.
     * Falls back to an absolute /storage URL, then null, so the page always renders.
     */
    private static function asset(string $path): ?string
    {
        $path = ltrim($path, '/');
        if ($path === '') {
            return null;
        }

        try {
            $disk = Storage::disk('public');
            if ($disk->exists($path)) {
                $mime = $disk->mimeType($path) ?: 'image/png';

                return 'data:'.$mime.';base64,'.base64_encode($disk->get($path));
            }
        } catch (\Throwable) {
            // fall through to URL
        }

        return '/storage/'.$path;
    }
}
