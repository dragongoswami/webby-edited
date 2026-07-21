<?php

namespace App\Services\Update;

use RuntimeException;

class UpdateBackup
{
    /** @var callable */
    private $exec;

    /**
     * @param  string[]  $codePaths  app-relative dirs/files to snapshot
     * @param  array  $db  ['driver'=>'sqlite','database'=>path] | ['driver'=>'mysql','host','port','database','username','password']
     */
    public function __construct(
        private string $appPath,
        private string $backupDir,
        private array $codePaths,
        private array $db,
        ?callable $exec = null,
    ) {
        $this->exec = $exec ?? function (string $cmd): int {
            $rc = 0;
            $out = [];
            exec($cmd.' 2>&1', $out, $rc);

            return $rc;
        };
    }

    public function create(): void
    {
        $tmp = $this->backupDir.'.tmp';
        $this->rmrf($tmp);
        mkdir($tmp, 0775, true);

        $existing = array_values(array_filter(
            $this->codePaths,
            fn ($p) => file_exists($this->appPath.'/'.$p)
        ));
        if ($existing !== []) {
            $list = implode(' ', array_map('escapeshellarg', $existing));
            $cmd = sprintf('tar -czf %s -C %s %s',
                escapeshellarg($tmp.'/code.tar.gz'),
                escapeshellarg($this->appPath),
                $list
            );
            if (($this->exec)($cmd) !== 0) {
                throw new RuntimeException('Code backup (tar) failed.');
            }
        }

        $this->dumpDatabase($tmp.'/db.dump');

        $this->rmrf($this->backupDir);
        rename($tmp, $this->backupDir);
    }

    public function restore(): void
    {
        $archive = $this->backupDir.'/code.tar.gz';
        if (is_file($archive)) {
            $cmd = sprintf('tar -xzf %s -C %s',
                escapeshellarg($archive),
                escapeshellarg($this->appPath)
            );
            if (($this->exec)($cmd) !== 0) {
                throw new RuntimeException('Code restore (tar) failed.');
            }
        }
        $this->restoreDatabase($this->backupDir.'/db.dump');
    }

    private function dumpDatabase(string $to): void
    {
        if ($this->db['driver'] === 'sqlite') {
            if (is_file($this->db['database'])) {
                if (! copy($this->db['database'], $to)) {
                    throw new RuntimeException('SQLite database backup failed.');
                }
            }

            return;
        }
        $cnf = $to.'.cnf';
        file_put_contents($cnf, "[client]\nhost=\"{$this->db['host']}\"\nport={$this->db['port']}\nuser=\"{$this->db['username']}\"\npassword=\"{$this->db['password']}\"\n");
        @chmod($cnf, 0600);
        $cmd = sprintf('mysqldump --defaults-extra-file=%s %s > %s',
            escapeshellarg($cnf), escapeshellarg($this->db['database']), escapeshellarg($to));
        $rc = ($this->exec)($cmd);
        @unlink($cnf);
        if ($rc !== 0) {
            throw new RuntimeException('Database dump failed.');
        }
    }

    private function restoreDatabase(string $from): void
    {
        if (! file_exists($from)) {
            return;
        }
        if ($this->db['driver'] === 'sqlite') {
            copy($from, $this->db['database']);

            return;
        }
        $cnf = $from.'.cnf';
        file_put_contents($cnf, "[client]\nhost=\"{$this->db['host']}\"\nport={$this->db['port']}\nuser=\"{$this->db['username']}\"\npassword=\"{$this->db['password']}\"\n");
        @chmod($cnf, 0600);
        $cmd = sprintf('mysql --defaults-extra-file=%s %s < %s',
            escapeshellarg($cnf), escapeshellarg($this->db['database']), escapeshellarg($from));
        $rc = ($this->exec)($cmd);
        @unlink($cnf);
        if ($rc !== 0) {
            throw new RuntimeException('Database restore failed.');
        }
    }

    private function rmrf(string $p): void
    {
        if (! file_exists($p)) {
            return;
        }
        if (is_file($p) || is_link($p)) {
            @unlink($p);

            return;
        }
        foreach (scandir($p) as $e) {
            if ($e === '.' || $e === '..') {
                continue;
            }
            $this->rmrf($p.'/'.$e);
        }
        @rmdir($p);
    }
}
