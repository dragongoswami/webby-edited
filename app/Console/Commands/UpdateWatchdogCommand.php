<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\NotificationService;
use App\Services\Update\UpdateBackup;
use App\Services\UpdateService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class UpdateWatchdogCommand extends Command
{
    protected $signature = 'app:update-watchdog';

    protected $description = 'Recover the site if a one-click auto-update stalled mid-swap.';

    /**
     * Absolute backstop for a truly hung update. The detached runner is NOT bound by
     * the queue-worker timeout, so this is a wall-clock safety net. Under the backstop,
     * a still-alive runner could be interrupted — accepted tradeoff.
     */
    private const BACKSTOP = 1800;

    private const PID_GRACE = 30;

    private const NO_PID_GRACE = 120;

    private const TERMINAL = ['success', 'failed', 'failed_rolledback'];

    public function handle(UpdateService $svc, NotificationService $notifications): int
    {
        if (! $svc->enabled()) {
            return self::SUCCESS;
        }

        $statusPath = storage_path('app/updates/status.json');
        if (! is_file($statusPath)) {
            return self::SUCCESS;
        }

        $status = json_decode((string) file_get_contents($statusPath), true) ?: [];
        $state = $status['state'] ?? null;
        if ($state === null || in_array($state, self::TERMINAL, true)) {
            return self::SUCCESS;
        }

        // The watchdog's sole purpose is recovering a site stranded in maintenance.
        // If the site is UP, the prepare phase (download/verify/backup) is still running
        // and is the job's own responsibility — ApplyUpdateJob handles spawn failures after `down`.
        if (! app()->isDownForMaintenance()) {
            return self::SUCCESS;
        }

        $age = time() - (int) @filemtime($statusPath);
        $pid = isset($status['pid']) ? (int) $status['pid'] : null;

        if (! $this->isStalled($pid, $age)) {
            return self::SUCCESS;
        }

        $this->recover($statusPath, $notifications);

        return self::SUCCESS;
    }

    private function isStalled(?int $pid, int $age): bool
    {
        if ($age >= self::BACKSTOP) {
            return true; // hung even if the process still appears alive
        }
        if ($pid === null) {
            return $age >= self::NO_PID_GRACE; // runner never wrote its pid
        }

        return ! $this->alive($pid) && $age >= self::PID_GRACE;
    }

    private function alive(int $pid): bool
    {
        if ($pid > 0 && function_exists('posix_kill')) {
            // posix_kill($pid, 0) assumes the scheduler runs as the same OS user that
            // spawned the runner — a cross-user probe returns EPERM and is treated as dead.
            return @posix_kill($pid, 0);
        }

        // posix unavailable: assume alive and rely on the timeout backstop.
        return true;
    }

    private function recover(string $statusPath, NotificationService $notifications): void
    {
        // Re-read state now that we (conceptually) hold the overlap lock — bail if
        // the runner finished in the gap between handle()'s read and this call.
        $fresh = json_decode((string) @file_get_contents($statusPath), true) ?: [];
        if (in_array($fresh['state'] ?? null, self::TERMINAL, true)) {
            return;
        }

        $title = 'Auto-update recovery failed';
        $message = 'Update stalled but could not be rolled back automatically (backup configuration missing). The site has been left in maintenance mode — manual intervention required.';
        $restored = false;

        $cfg = json_decode((string) @file_get_contents(storage_path('app/updates/runner/runner-config.json')), true);
        if (is_array($cfg) && isset($cfg['app_path'], $cfg['backup_dir'], $cfg['code_paths'], $cfg['db'])) {
            try {
                (new UpdateBackup($cfg['app_path'], $cfg['backup_dir'], $cfg['code_paths'], $cfg['db']))->restore();
                $restored = true;
            } catch (\Throwable $e) {
                $message = 'Watchdog recovery failed: '.$e->getMessage();
            }
        }

        if ($restored) {
            Artisan::call('up');
            $title = 'Auto-update recovered';
            $message = 'Update stalled and was automatically rolled back by the watchdog.';
            $this->writeTerminal($statusPath, 'failed_rolledback', $message);
        } else {
            $this->writeTerminal($statusPath, 'failed', $message);
        }

        foreach (User::where('role', 'admin')->get() as $admin) {
            $notifications->notify(
                $admin,
                'system',
                $title,
                $message,
                null,
                route('admin.settings').'?tab=updates'
            );
        }
    }

    private function writeTerminal(string $statusPath, string $state, string $message): void
    {
        @file_put_contents($statusPath, json_encode([
            'state' => $state, 'phase' => 'failed', 'percent' => 100, 'message' => $message,
        ]));
    }
}
