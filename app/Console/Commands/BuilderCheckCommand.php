<?php

namespace App\Console\Commands;

use App\Models\CronLog;
use App\Services\BuilderUpdateService;
use App\Services\UpdateService;
use Illuminate\Console\Command;

class BuilderCheckCommand extends Command
{
    protected $signature = 'builder:check
                            {--triggered-by=cron : Who triggered this command (cron or manual:user_id)}';

    protected $description = 'Sync active builders to the current app version (auto-update).';

    public function handle(UpdateService $updates, BuilderUpdateService $builders): int
    {
        if (! $updates->enabled()) {
            return self::SUCCESS;
        }

        $cronLog = CronLog::startLog(
            'Sync Builder Versions',
            self::class,
            $this->option('triggered-by')
        );

        try {
            $builders->sync();
            $cronLog->markSuccess('Builder version sync complete.');

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $cronLog->markFailed($e->getTraceAsString(), $e->getMessage());

            return self::FAILURE;
        }
    }
}
