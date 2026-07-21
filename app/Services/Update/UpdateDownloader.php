<?php

namespace App\Services\Update;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class UpdateDownloader
{
    public function download(string $url, string $dest): void
    {
        if (! is_dir(dirname($dest))) {
            mkdir(dirname($dest), 0775, true);
        }
        $tmp = $dest.'.part';

        $resp = Http::timeout(900)->withOptions(['stream' => true])->get($url);
        if (! $resp->successful()) {
            @unlink($tmp);
            // Surface the update server's response body (e.g. {"error":"not_entitled"})
            // so the failure the UI shows names the real cause instead of a bare status.
            $detail = trim(substr((string) $resp->body(), 0, 200));

            throw new RuntimeException('Download failed: HTTP '.$resp->status().($detail !== '' ? ' — '.$detail : ''));
        }

        $digest = $resp->header('Digest');
        if (! $digest) {
            @unlink($tmp);
            throw new RuntimeException('Update server did not provide a Digest header — aborting.');
        }
        if (! preg_match('/(?:^|,\s*)sha-256=([A-Za-z0-9+\/=]+)/', $digest, $m)) {
            @unlink($tmp);
            throw new RuntimeException('Update server Digest header missing sha-256 — aborting.');
        }

        $out = @fopen($tmp, 'wb');
        if ($out === false) {
            throw new RuntimeException("Cannot write the update download to {$tmp} — check filesystem permissions and available disk space.");
        }
        $body = $resp->toPsrResponse()->getBody();
        if ($body->isSeekable()) {
            $body->rewind();
        }
        while (! $body->eof()) {
            fwrite($out, $body->read(1048576));
        }
        fclose($out);

        $actual = base64_encode(hash_file('sha256', $tmp, true));
        if (! hash_equals($m[1], $actual)) {
            @unlink($tmp);
            throw new RuntimeException('Checksum mismatch — aborting update.');
        }

        rename($tmp, $dest);
    }
}
