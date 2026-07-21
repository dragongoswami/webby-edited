<?php

namespace App\Jobs;

use App\Events\Update\UpdateProgressEvent;
use App\Models\SystemSetting;
use App\Services\Update\BuilderBinaryStager;
use App\Services\Update\BuilderPromptsStager;
use App\Services\Update\UpdateBackup;
use App\Services\Update\UpdateDownloader;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;

class ApplyUpdateJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public int $uniqueFor = 3600;

    /** @var callable|null */
    private $spawner = null;

    public function __construct(public string $downloadUrl, public int $userId) {}

    public function setSpawner(callable $spawner): void
    {
        $this->spawner = $spawner;
    }

    public function uniqueId(): string
    {
        return 'app-update';
    }

    public function handle(UpdateDownloader $downloader): void
    {
        try {
            $this->runUpdate($downloader);
        } catch (\Throwable $e) {
            // Failures here can happen at any stage: download, verify, backup, or spawning
            // the runner. If `artisan down` already ran before a spawn failure, bring the
            // site back up before writing the terminal state — otherwise the site is stranded
            // in maintenance with no actor to recover it (the watchdog skips terminal states,
            // and the runner was never spawned). If `down` never ran, `up` is a harmless
            // no-op. Either way, record a terminal 'failed' state so the polling UI surfaces
            // the error instead of sitting forever on the last 'preparing' message. (The
            // runner handles its own post-swap failures with a 'failed_rolledback' state.)
            try {
                Artisan::call('up');
            } catch (\Throwable) {
                // Best-effort — swallow errors so the terminal status is always written.
            }
            $this->emit([
                'state' => 'failed',
                'phase' => 'failed',
                'percent' => 100,
                'message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function runUpdate(UpdateDownloader $downloader): void
    {
        $base = storage_path('app/updates');
        $runner = $base.'/runner';
        $zip = $base.'/download/release.zip';
        $this->rmrf($runner);
        @mkdir($runner, 0775, true);

        $this->progress('download', 5, 'Starting');
        $downloader->download($this->downloadUrl, $zip);

        // Stage the builder binaries + prompts for the builder auto-update flow (best-effort).
        try {
            (new BuilderBinaryStager)->stage($zip, $base.'/builder');
        } catch (\Throwable $e) {
            // Builder staging must never block the Laravel update.
        }
        try {
            (new BuilderPromptsStager)->stage($zip, $base.'/builder/prompts');
        } catch (\Throwable $e) {
            // Prompts staging must never block the Laravel update.
        }

        $codePaths = ['app', 'bootstrap', 'config', 'database', 'public/build', 'resources', 'routes', 'composer.json', 'composer.lock', '.version'];
        $db = $this->dbConfig();
        $this->progress('verify', 40, 'Downloaded');
        (new UpdateBackup(base_path(), $base.'/backup', $codePaths, $db))->create();
        $this->progress('backup', 70, 'Backed up');

        copy(app_path('Services/Update/ReleaseArchive.php'), $runner.'/ReleaseArchive.php');
        copy(app_path('Services/Update/UpdateBackup.php'), $runner.'/UpdateBackup.php');
        copy(app_path('Services/Update/UpdateApplier.php'), $runner.'/UpdateApplier.php');
        copy(resource_path('stubs/update-runner.php'), $runner.'/update-runner.php');

        file_put_contents($runner.'/runner-config.json', json_encode([
            'app_path' => base_path(),
            'zip_path' => $zip,
            'backup_dir' => $base.'/backup',
            'status_path' => $base.'/status.json',
            'skip' => ['storage/', '.env', 'public/storage'],
            'code_paths' => $codePaths,
            'db' => $db,
        ]));

        // Enter maintenance with a branded, pre-rendered page BEFORE the swap. This runs
        // inside the fully-booted (old) app, so SystemSetting + assets are reachable and
        // Laravel freezes the HTML for the whole window — surviving the mid-swap tree.
        $retry = max(5, (int) SystemSetting::get('maintenance_retry', 60) ?: 60);
        if (Artisan::call('down', ['--render' => 'errors::503', '--retry' => $retry]) !== 0) {
            throw new \RuntimeException('Failed to enter maintenance mode');
        }

        $this->progress('apply', 85, 'Applying');
        ($this->spawner ?? $this->defaultSpawner())($runner.'/update-runner.php');
    }

    private function progress(string $phase, int $percent, string $message): void
    {
        $this->emit([
            'state' => 'preparing',
            'phase' => $phase,
            'percent' => $percent,
            'message' => $message,
        ]);
    }

    /**
     * Persist the update status to disk AND broadcast it. The status file is the
     * source of truth the admin UI polls, so it is written FIRST and always —
     * broadcasting is a best-effort nicety layered on top. Writing the file is what
     * lets the UI reflect progress (and failures) even when Reverb/Pusher is down or
     * unconfigured, so the progress bar can never silently freeze on a dead run.
     *
     * Under QUEUE_CONNECTION=sync, UpdateProgressEvent (ShouldBroadcastNow) runs
     * inline, so a broadcast failure must be swallowed or it would bubble up to the
     * updatesApply request as a 500 and abort the update.
     */
    private function emit(array $payload): void
    {
        $this->writeStatus($payload);

        try {
            UpdateProgressEvent::dispatch($this->userId, $payload);
        } catch (\Throwable $e) {
            // Best-effort only — swallow broadcast failures so the update can proceed.
        }
    }

    private function writeStatus(array $payload): void
    {
        $path = storage_path('app/updates/status.json');
        if (! is_dir(dirname($path))) {
            @mkdir(dirname($path), 0775, true);
        }
        @file_put_contents($path, json_encode($payload));
    }

    private function defaultSpawner(): callable
    {
        return function (string $script): void {
            if (! function_exists('proc_open')) {
                throw new \RuntimeException('proc_open is disabled; update manually.');
            }
            $cmd = 'php '.escapeshellarg($script).' > /dev/null 2>&1 &';
            proc_close(proc_open($cmd, [], $pipes));
        };
    }

    private function dbConfig(): array
    {
        $conn = config('database.default');
        $c = config("database.connections.$conn");

        return match ($c['driver'] ?? '') {
            'sqlite' => ['driver' => 'sqlite', 'database' => $c['database']],
            'mysql', 'mariadb' => [
                'driver' => 'mysql', 'host' => $c['host'], 'port' => $c['port'] ?? 3306,
                'database' => $c['database'], 'username' => $c['username'], 'password' => $c['password'] ?? '',
            ],
            default => throw new \RuntimeException('Unsupported DB driver for auto-update backup: '.($c['driver'] ?? 'unknown')),
        };
    }

    private function rmrf(string $p): void
    {
        if (! file_exists($p)) {
            return;
        }
        if (is_file($p)) {
            @unlink($p);

            return;
        }
        foreach (scandir($p) as $e) {
            if ($e !== '.' && $e !== '..') {
                $this->rmrf($p.'/'.$e);
            }
        }
        @rmdir($p);
    }
}
