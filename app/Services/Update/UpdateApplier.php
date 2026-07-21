<?php

namespace App\Services\Update;

use Throwable;

class UpdateApplier
{
    /** @var callable */
    private $exec;

    private ?int $pid = null;

    public function __construct(
        private string $appPath,
        private string $zipPath,
        private string $statusPath,
        private array $skip,
        private UpdateBackup $backup,
        ?callable $exec = null,
    ) {
        $this->exec = $exec ?? function (string $cmd): int {
            $rc = 0;
            $out = [];
            exec($cmd.' 2>&1', $out, $rc);

            return $rc;
        };
        $this->pid = getmypid() ?: null;
    }

    public function apply(): void
    {
        try {
            $this->status('updating', 'swap', 35, 'Swapping files');
            (new ReleaseArchive($this->zipPath))->extractTo($this->appPath, $this->skip);

            $this->status('updating', 'migrate', 65, 'Running migrations');
            if ($this->artisan('migrate --force') !== 0) {
                throw new \RuntimeException('migrate failed');
            }

            $this->status('updating', 'finalize', 85, 'Finalizing');
            $this->artisan('optimize:clear');
            $this->artisan('storage:link');
            if ($this->artisan('up') !== 0) {
                throw new \RuntimeException('artisan up failed after update');
            }

            $this->status('success', 'done', 100, 'Update complete');
        } catch (Throwable $e) {
            $this->rollback($e->getMessage());
        }
    }

    private function rollback(string $reason): void
    {
        $this->status('rolling_back', 'restore', 50, 'Restoring previous version');
        try {
            $this->backup->restore();
        } catch (Throwable) {
            // best effort
        }
        $this->artisan('up');
        $this->status('failed_rolledback', 'failed', 100, $reason);
    }

    private function artisan(string $cmd): int
    {
        return ($this->exec)('php '.$this->appPath.'/artisan '.$cmd);
    }

    private function status(string $state, string $phase, int $percent, string $message): void
    {
        if (! is_dir(dirname($this->statusPath))) {
            mkdir(dirname($this->statusPath), 0775, true);
        }
        $payload = compact('state', 'phase', 'percent', 'message');
        $payload['pid'] = $this->pid;
        file_put_contents($this->statusPath, json_encode($payload));
    }
}
