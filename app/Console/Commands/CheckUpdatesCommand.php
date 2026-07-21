<?php

namespace App\Console\Commands;

use App\Jobs\ApplyUpdateJob;
use App\Models\CronLog;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\UpdateService;
use Illuminate\Console\Command;

class CheckUpdatesCommand extends Command
{
    protected $signature = 'app:check-updates
                            {--triggered-by=cron : Who triggered this command (cron or manual:user_id)}';

    protected $description = 'Check the vendor update server for a new release.';

    public function handle(UpdateService $svc, NotificationService $notifications): int
    {
        if (! $svc->enabled()) {
            return self::SUCCESS;
        }

        $cronLog = CronLog::startLog(
            'Check for Updates',
            self::class,
            $this->option('triggered-by')
        );

        try {
            $res = $svc->check();
            if (empty($res['update'])) {
                SystemSetting::set('update_available', false, 'boolean', 'general');
                $cronLog->markSuccess('No update available.');

                return self::SUCCESS;
            }

            SystemSetting::set('update_available', true, 'boolean', 'general');
            SystemSetting::set('update_latest', $res['latest'] ?? '', 'string', 'general');
            SystemSetting::set('update_changelog', $res['changelog'] ?? '', 'string', 'general');

            foreach (User::where('role', 'admin')->get() as $admin) {
                $notifications->notify(
                    $admin,
                    'system',
                    __('Update available'),
                    __('Version :v is available.', ['v' => $res['latest'] ?? '']),
                    null,
                    route('admin.settings').'?tab=updates'
                );
            }

            $autoApplied = false;
            if ($svc->autoApply() && ! empty($res['download_url'])) {
                ApplyUpdateJob::dispatch(
                    UpdateService::HOST.$res['download_url'],
                    (int) User::where('role', 'admin')->value('id')
                );
                $autoApplied = true;
            }

            $cronLog->markSuccess(
                "Update available: {$res['latest']}".($autoApplied ? ' (auto-apply queued).' : '.')
            );

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $cronLog->markFailed($e->getTraceAsString(), $e->getMessage());

            return self::FAILURE;
        }
    }
}
