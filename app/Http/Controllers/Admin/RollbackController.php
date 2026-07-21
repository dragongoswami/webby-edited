<?php

namespace App\Http\Controllers\Admin;

use App\Console\Commands\RollbackCommand;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class RollbackController extends Controller
{
    public function index(): JsonResponse
    {
        $backups = RollbackCommand::listBackups();

        return response()->json([
            'backups' => $backups,
        ]);
    }

    public function rollback(Request $request): JsonResponse
    {
        $request->validate([
            'backup' => 'required|string',
        ]);

        $backupName = $request->input('backup');
        $backupPath = storage_path("app/backups/{$backupName}");

        if (!is_dir($backupPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Backup not found: ' . $backupName,
            ], 404);
        }

        $this->putStatus('rolling_back', 10, 'Starting rollback...');

        try {
            Artisan::call('down', ['--render' => 'errors::503']);

            $this->putStatus('rolling_back', 20, 'Restoring Laravel app...');
            $installPath = base_path();
            $tarFile = $backupPath . '/Install_files.tar.gz';
            if (file_exists($tarFile)) {
                exec("cd " . escapeshellarg($installPath) . " && tar -xzf " . escapeshellarg($tarFile) . " --overwrite");
            }

            $this->putStatus('rolling_back', 35, 'Restoring Builder...');
            $builderTarFile = $backupPath . '/Builder_files.tar.gz';
            if (file_exists($builderTarFile)) {
                $builderPath = dirname($installPath);
                exec("cd " . escapeshellarg($builderPath) . " && tar -xzf " . escapeshellarg($builderTarFile) . " --overwrite");
            }

            $this->putStatus('rolling_back', 50, 'Restoring database...');
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

            $this->putStatus('rolling_back', 70, 'Restarting services...');
            Process::run('pm2 restart webby-builder 2>/dev/null || true');
            Process::run('pm2 restart webby-reverb 2>/dev/null || true');
            Process::run('pm2 save 2>/dev/null || true');

            $this->putStatus('rolling_back', 85, 'Rolling back remote builders...');
            $this->rollbackRemoteBuilders();

            Artisan::call('up');

            $this->putStatus('success', 100, 'Rollback completed successfully!');

            return response()->json([
                'success' => true,
                'message' => 'Rollback completed successfully!',
            ]);
        } catch (\Throwable $e) {
            $this->putStatus('failed', 100, 'Rollback failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Rollback failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    protected function rollbackRemoteBuilders(): void
    {
        $builders = \App\Models\Builder::active()->get();
        if ($builders->isEmpty()) {
            return;
        }

        foreach ($builders as $builder) {
            $this->rollbackRemoteBuilder($builder);
        }
    }

    protected function rollbackRemoteBuilder($builder): void
    {
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
        ];

        $command = implode(' && ', $remoteCommands);
        $fullSshCmd = "ssh -i {$sshKey} -o StrictHostKeyChecking=no {$sshUser}@{$sshHost} '{$command}'";

        Process::timeout(300)->run($fullSshCmd);
    }

    protected function putStatus(string $state, int $percent, string $message): void
    {
        $statusFile = storage_path('app/updates/status.json');
        if (!is_dir(dirname($statusFile))) {
            @mkdir(dirname($statusFile), 0775, true);
        }
        file_put_contents($statusFile, json_encode([
            'state' => $state,
            'percent' => $percent,
            'message' => $message,
            'updated_at' => now()->toIso8601String(),
        ]));
    }
}