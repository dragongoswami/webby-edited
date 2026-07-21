<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class RollbackCommand extends Command
{
    protected $signature = 'app:rollback
                            {--backup= : Specific backup folder name to restore (optional, will show list if not provided)}
                            {--force : Skip confirmation}
                            {--skip-remote : Skip rolling back remote builder servers}';

    protected $description = 'Rollback to a previous backup. Shows list of available backups if no specific one selected.';

    public function handle(): int
    {
        $backupName = $this->option('backup');
        $force = $this->option('force');
        $skipRemote = $this->option('skip-remote');

        if ($backupName) {
            $backupPath = storage_path("app/backups/{$backupName}");
            if (!is_dir($backupPath)) {
                $this->error("Backup not found: {$backupName}");
                return 1;
            }
        } else {
            $backups = $this->getAvailableBackups();
            if (empty($backups)) {
                $this->error('No backups available.');
                return 1;
            }
            $backupName = $this->choice(
                'Select backup to rollback to:',
                array_column($backups, 'name'),
                0,
                false
            );
            $backupPath = storage_path("app/backups/{$backupName}");
        }

        $this->info("Rollback target: {$backupName}");
        $this->showBackupInfo($backupPath);

        if (!$force && !$this->confirm('This will replace current files and database. Continue?')) {
            $this->info('Cancelled.');
            return 0;
        }

        try {
            $this->rollbackToBackup($backupPath, $skipRemote);
            $this->info('Rollback completed successfully!');
            return 0;
        } catch (\Throwable $e) {
            $this->error('Rollback failed: ' . $e->getMessage());
            return 1;
        }
    }

    protected function getAvailableBackups(): array
    {
        $backupDir = storage_path('app/backups');
        if (!is_dir($backupDir)) return [];

        $backups = glob($backupDir . '/webby_backup_*');
        $result = [];

        foreach ($backups as $path) {
            $name = basename($path);
            $metaFile = $path . '/metadata.json';
            $created = file_exists($metaFile)
                ? date('Y-m-d H:i:s', filemtime($path))
                : date('Y-m-d H:i:s', filemtime($path));

            $result[] = [
                'name' => $name,
                'path' => $path,
                'created' => $created,
            ];
        }

        usort($result, fn($a, $b) => strtotime($b['created']) - strtotime($a['created']));

        return array_slice($result, 0, 3);
    }

    protected function showBackupInfo(string $backupPath): void
    {
        $metaFile = $backupPath . '/metadata.json';
        if (file_exists($metaFile)) {
            $meta = json_decode(file_get_contents($metaFile), true);
            $this->info("Backup info:");
            $this->line("  - Timestamp: " . ($meta['timestamp'] ?? 'N/A'));
            $this->line("  - Branch: " . ($meta['branch'] ?? 'N/A'));
            $this->line("  - Repository: " . ($meta['repo'] ?? 'N/A'));
        }

        $hasInstall = file_exists($backupPath . '/Install_files.tar.gz');
        $hasBuilder = file_exists($backupPath . '/Builder_files.tar.gz');
        $hasDb = file_exists($backupPath . '/database.sql');

        $this->info("Contents:");
        $this->line("  - Laravel App: " . ($hasInstall ? '✓' : '✗'));
        $this->line("  - Builder: " . ($hasBuilder ? '✓' : '✗'));
        $this->line("  - Database: " . ($hasDb ? '✓' : '✗'));
    }

    protected function rollbackToBackup(string $backupPath, bool $skipRemote): void
    {
        $this->info('Starting rollback...');

        $this->info('[1/5] Enabling maintenance mode...');
        Artisan::call('down', ['--render' => 'errors::503']);

        $this->info('[2/5] Restoring Laravel app...');
        $installPath = base_path();
        $tarFile = $backupPath . '/Install_files.tar.gz';
        if (file_exists($tarFile)) {
            exec("cd " . escapeshellarg($installPath) . " && tar -xzf " . escapeshellarg($tarFile) . " --overwrite");
        }

        $this->info('[3/5] Restoring Builder...');
        $builderTarFile = $backupPath . '/Builder_files.tar.gz';
        if (file_exists($builderTarFile)) {
            $builderPath = dirname($installPath);
            exec("cd " . escapeshellarg($builderPath) . " && tar -xzf " . escapeshellarg($builderTarFile) . " --overwrite");
        }

        $this->info('[4/5] Restoring database...');
        $dumpFile = $backupPath . '/database.sql';
        if (file_exists($dumpFile)) {
            $dbName = config('database.connections.mysql.database');
            $dbUser = config('database.connections.mysql.username');
            $dbPass = config('database.connections.mysql.password');
            exec("mysql -u " . escapeshellarg($dbUser) . " -p" . escapeshellarg($dbPass) . " " . escapeshellarg($dbName) . " < " . escapeshellarg($dumpFile));
        }

        Artisan::call('config:clear');
        Artisan::call('view:clear');
        Artisan::call('cache:clear');

        $this->restartServices();

        if (!$skipRemote) {
            $this->info('[5/5] Rolling back remote builders...');
            $this->rollbackRemoteBuilders();
        }

        Artisan::call('up');

        $this->info('Rollback complete!');
    }

    protected function rollbackRemoteBuilders(): void
    {
        if (!class_exists('App\Models\Builder')) {
            $this->warn('Builder model not found, skipping remote rollback.');
            return;
        }

        $builders = \App\Models\Builder::active()->get();
        if ($builders->isEmpty()) {
            $this->info('No remote builder servers configured.');
            return;
        }

        $this->info("Rolling back {$builders->count()} remote builder(s)...");

        foreach ($builders as $builder) {
            $this->rollbackRemoteBuilder($builder);
        }
    }

    protected function rollbackRemoteBuilder($builder): void
    {
        $this->info("Rolling back builder: {$builder->name}");

        $sshHost = $builder->ssh_host ?? parse_url($builder->url, PHP_URL_HOST);
        $sshUser = $builder->ssh_user ?? 'root';
        $sshKey = $builder->ssh_key_path ?? '/root/.ssh/id_rsa';
        $builderSourcePath = $builder->builder_source_path ?? '/home/Builder';

        $remoteCommands = [
            "cd {$builderSourcePath}",
            "git fetch origin main",
            "git reset --hard origin/main",
            "go build -o webby-builder-linux ./src/main.go",
            "chmod +x webby-builder-linux",
            "pm2 restart webby-builder 2>/dev/null || true",
            "pm2 save 2>/dev/null || true",
            "echo 'Builder {$builder->name} rolled back successfully'",
        ];

        $command = implode(' && ', $remoteCommands);
        $fullSshCmd = "ssh -i {$sshKey} -o StrictHostKeyChecking=no {$sshUser}@{$sshHost} '{$command}'";

        $result = Process::timeout(300)->run($fullSshCmd);

        if ($result->successful()) {
            $this->info("✓ {$builder->name} rolled back successfully");
        } else {
            $this->warn("✗ {$builder->name} rollback failed: " . $result->errorOutput());
        }
    }

    protected function restartServices(): void
    {
        Process::run('pm2 restart webby-builder 2>/dev/null || true');
        Process::run('pm2 restart webby-reverb 2>/dev/null || true');
        Process::run('pm2 save 2>/dev/null || true');
    }

    public static function listBackups(): array
    {
        $backupDir = storage_path('app/backups');
        if (!is_dir($backupDir)) return [];

        $backups = glob($backupDir . '/webby_backup_*');
        $result = [];

        foreach ($backups as $path) {
            $name = basename($path);
            $metaFile = $path . '/metadata.json';
            $created = file_exists($metaFile)
                ? date('Y-m-d H:i:s', filemtime($path))
                : date('Y-m-d H:i:s', filemtime($path));

            $result[] = [
                'name' => $name,
                'path' => $path,
                'created' => $created,
            ];
        }

        usort($result, fn($a, $b) => strtotime($b['created']) - strtotime($a['created']));

        return array_slice($result, 0, 3);
    }
}