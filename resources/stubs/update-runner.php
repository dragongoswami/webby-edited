<?php

// Standalone update runner — runs OUTSIDE the app tree so it survives the swap.
$dir = __DIR__;
require $dir.'/ReleaseArchive.php';
require $dir.'/UpdateBackup.php';
require $dir.'/UpdateApplier.php';

use App\Services\Update\UpdateApplier;
use App\Services\Update\UpdateBackup;

$cfg = null;
try {
    $cfg = json_decode(file_get_contents($dir.'/runner-config.json'), true);
    if (! is_array($cfg)) {
        throw new RuntimeException('runner-config.json missing or malformed');
    }
    $backup = new UpdateBackup($cfg['app_path'], $cfg['backup_dir'], $cfg['code_paths'], $cfg['db']);
    $applier = new UpdateApplier($cfg['app_path'], $cfg['zip_path'], $cfg['status_path'], $cfg['skip'], $backup);
    $applier->apply();
} catch (Throwable $e) {
    // Early throws (malformed config, constructor failure) happen pre-extract — the
    // app tree is still intact, so bring the site back up before writing terminal
    // status. Without this, the site stays in maintenance with no actor to recover
    // it (the watchdog treats failed_rolledback as terminal and will not intervene).
    if (is_array($cfg) && ! empty($cfg['app_path'])) {
        @exec('php '.escapeshellarg($cfg['app_path'].'/artisan').' up 2>&1');
    }
    $statusPath = is_array($cfg) && isset($cfg['status_path']) ? $cfg['status_path'] : $dir.'/status.json';
    @file_put_contents($statusPath, json_encode([
        'state' => 'failed_rolledback', 'phase' => 'failed', 'percent' => 100, 'message' => $e->getMessage(),
    ]));
    exit(1);
}
