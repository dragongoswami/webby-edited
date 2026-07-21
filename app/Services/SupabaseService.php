<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use PDO;
use Throwable;

/**
 * Resolves a project's BYOD Supabase backend and manages its per-project
 * Postgres schema.
 *
 * Tenancy: bring-your-own-database. Each user maintains a library of their own
 * Supabase connections (supabase_connections); a project attaches one
 * (projects.supabase_connection_id) and gets its own schema `proj_<uuid>` inside
 * that user-owned database. The platform never provisions or owns a backend.
 */
class SupabaseService
{
    /** Postgres column types the agent may request. */
    private const ALLOWED_TYPES = ['text', 'varchar', 'int', 'bigint', 'numeric', 'boolean', 'timestamptz', 'date', 'uuid', 'jsonb'];

    /** Columns the platform manages — the agent may never define these. */
    private const RESERVED_COLUMNS = ['id', 'created_at', 'user_id'];

    /** Safe identifier pattern (lowercase, starts with letter/underscore, max 63 chars). */
    // D (PCRE_DOLLAR_ENDONLY): reject a trailing newline the bare $ would otherwise allow.
    private const IDENT = '/^[a-z_][a-z0-9_]{0,62}$/D';

    /** True when the project has a usable BYOD connection (url + db connection). */
    public function hasConnection(Project $project): bool
    {
        $conn = $project->supabaseConnection;

        return $conn !== null && (string) $conn->url !== '' && (string) $conn->db_connection !== '';
    }

    /**
     * The connection bundle the Go builder agent needs for a project (sent
     * server-to-server only). NEVER include this in Inertia/browser responses —
     * it contains the secret key and DB password. Sourced from the project's
     * linked BYOD connection; empty bundle when none is attached.
     *
     * @return array{url:string,publishable_key:string,secret_key:string,schema:string,db_connection:string}
     */
    public function resolveForProject(Project $project): array
    {
        $schema = $this->getProjectSchema($project);
        $conn = $project->supabaseConnection;

        if (! $conn) {
            return [
                'url' => '',
                'publishable_key' => '',
                'secret_key' => '',
                'schema' => $schema,
                'db_connection' => '',
            ];
        }

        return [
            'url' => (string) $conn->url,
            'publishable_key' => (string) $conn->publishable_key,
            'secret_key' => (string) $conn->secret_key,
            'schema' => $schema,
            'db_connection' => (string) $conn->db_connection,
        ];
    }

    /** Stable Postgres schema name for a project. */
    public function getProjectSchema(Project $project): string
    {
        return $project->getSupabaseSchema();
    }

    /**
     * Build the platform-authored DDL for a `defineTable` request. PURE: no I/O.
     * Validates every identifier, the column types, the access mode, and the
     * defaults so no agent-supplied string is ever interpolated unvalidated.
     * Returns an ordered list of SQL statements (CREATE TABLE + RLS + grants +
     * policies + PostgREST reload) to execute as-is.
     *
     * @return list<string>
     *
     * @throws \InvalidArgumentException on any invalid/unsafe input
     */
    public function buildDefineTableSql(array $spec, string $schema): array
    {
        $table = $spec['table'] ?? '';
        $access = $spec['access'] ?? '';
        $columns = $spec['columns'] ?? [];

        if (! preg_match(self::IDENT, $schema) || ! str_starts_with($schema, 'proj_')) {
            throw new \InvalidArgumentException('Invalid schema');
        }
        if (! is_string($table) || ! preg_match(self::IDENT, $table)) {
            throw new \InvalidArgumentException('Invalid table name');
        }
        if (! in_array($access, ['public', 'private'], true)) {
            throw new \InvalidArgumentException('Invalid access');
        }
        if (! is_array($columns) || count($columns) === 0) {
            throw new \InvalidArgumentException('At least one column required');
        }

        $defs = [];
        foreach ($columns as $col) {
            $name = $col['name'] ?? '';
            $type = strtolower((string) ($col['type'] ?? ''));
            if (! is_string($name) || ! preg_match(self::IDENT, $name)) {
                throw new \InvalidArgumentException("Invalid column name: {$name}");
            }
            if (in_array($name, self::RESERVED_COLUMNS, true)) {
                throw new \InvalidArgumentException("Reserved column name: {$name}");
            }
            if (! in_array($type, self::ALLOWED_TYPES, true)) {
                throw new \InvalidArgumentException("Invalid type: {$type}");
            }
            $def = "\"{$name}\" {$type}";
            if (array_key_exists('default', $col) && $col['default'] !== null && $col['default'] !== '') {
                $def .= ' default '.$this->safeDefault((string) $col['default']);
            }
            $defs[] = $def;
        }

        $q = "{$schema}.\"{$table}\"";
        $cols = [];
        $cols[] = '"id" uuid primary key default gen_random_uuid()';
        $cols[] = '"created_at" timestamptz not null default now()';
        if ($access === 'private') {
            $cols[] = '"user_id" uuid not null default auth.uid() references auth.users(id) on delete cascade';
        }
        $cols = array_merge($cols, $defs);

        $sql = [];
        $sql[] = "CREATE TABLE IF NOT EXISTS {$q} (\n  ".implode(",\n  ", $cols)."\n)";
        $sql[] = "ALTER TABLE {$q} ENABLE ROW LEVEL SECURITY";

        if ($access === 'public') {
            $sql[] = "GRANT SELECT, INSERT, UPDATE, DELETE ON {$q} TO anon, authenticated";
            foreach (['select' => 'USING (true)', 'insert' => 'WITH CHECK (true)', 'update' => 'USING (true)', 'delete' => 'USING (true)'] as $cmd => $clause) {
                $pname = "{$table}_public_{$cmd}";
                $sql[] = "DROP POLICY IF EXISTS \"{$pname}\" ON {$q}";
                $sql[] = "CREATE POLICY \"{$pname}\" ON {$q} FOR ".strtoupper($cmd)." TO anon, authenticated {$clause}";
            }
        } else { // private
            $sql[] = "GRANT SELECT, INSERT, UPDATE, DELETE ON {$q} TO authenticated";
            foreach (['select' => 'USING (auth.uid() = user_id)', 'insert' => 'WITH CHECK (auth.uid() = user_id)', 'update' => 'USING (auth.uid() = user_id)', 'delete' => 'USING (auth.uid() = user_id)'] as $cmd => $clause) {
                $pname = "{$table}_private_{$cmd}";
                $sql[] = "DROP POLICY IF EXISTS \"{$pname}\" ON {$q}";
                $sql[] = "CREATE POLICY \"{$pname}\" ON {$q} FOR ".strtoupper($cmd)." TO authenticated {$clause}";
            }
        }
        $sql[] = "NOTIFY pgrst, 'reload schema'";

        return $sql;
    }

    /**
     * Validate a column default against a tiny allowlist of safe expressions:
     * known functions/keywords or a single-quoted literal with no embedded quote.
     *
     * @throws \InvalidArgumentException when the default is not provably safe
     */
    private function safeDefault(string $d): string
    {
        $d = trim($d);
        $allowed = ['now()', 'gen_random_uuid()', 'true', 'false', 'null'];
        if (in_array(strtolower($d), $allowed, true)) {
            return strtolower($d);
        }
        if (preg_match("/^'[^']*'$/", $d)) { // single-quoted literal, no embedded quote
            return $d;
        }
        throw new \InvalidArgumentException("Unsafe default: {$d}");
    }

    /**
     * Execute a validated `defineTable` request for a project. Resolves the
     * secret connection, builds the SQL via buildDefineTableSql(), and runs each
     * statement. Safe no-op (ok:false) when the project has no DB connection or
     * the spec is invalid — never throws.
     *
     * @return array{ok:bool,table?:string,access?:string,error?:string}
     */
    public function defineTable(Project $project, array $spec): array
    {
        $config = $this->resolveForProject($project);
        if (empty($config['db_connection'])) {
            return ['ok' => false, 'error' => 'Supabase not configured for this project'];
        }

        try {
            $statements = $this->buildDefineTableSql($spec, $config['schema']);
        } catch (\InvalidArgumentException $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }

        $pdo = $this->connect($config['db_connection']);
        if (! $pdo) {
            return ['ok' => false, 'error' => 'Could not connect to the database'];
        }

        try {
            foreach ($statements as $stmt) {
                $pdo->exec($stmt);
            }

            return ['ok' => true, 'table' => $spec['table'], 'access' => $spec['access']];
        } catch (Throwable $e) {
            Log::warning('SupabaseService: defineTable failed', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return ['ok' => false, 'error' => 'Failed to create table'];
        }
    }

    /**
     * Ensure the project's schema exists, is granted to the API roles, and is
     * exposed to PostgREST. Safe no-op when no DB connection is configured
     * (e.g. tests, or a plan without the Database capability).
     */
    public function ensureProjectSchema(Project $project): void
    {
        $config = $this->resolveForProject($project);
        $schema = $config['schema'];

        $pdo = $this->connect($config['db_connection']);
        if (! $pdo) {
            return;
        }

        try {
            // Reserved/identifier safety: schema is derived from a UUID, but guard anyway.
            if (! preg_match('/^proj_[a-z0-9_]+$/i', $schema)) {
                throw new \InvalidArgumentException("Unsafe schema name: {$schema}");
            }

            $pdo->exec("CREATE SCHEMA IF NOT EXISTS {$schema}");
            $pdo->exec("GRANT USAGE ON SCHEMA {$schema} TO anon, authenticated");
            $pdo->exec("ALTER DEFAULT PRIVILEGES IN SCHEMA {$schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated");

            $this->exposeSchema($pdo, $schema, true);
            $project->forceFill(['supabase_schema' => $schema])->saveQuietly();
        } catch (Throwable $e) {
            Log::warning('SupabaseService: ensureProjectSchema failed', [
                'project_id' => $project->id,
                'schema' => $schema,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /** Drop a project's schema and unexpose it. Safe no-op when unconfigured. */
    public function dropProjectSchema(Project $project): void
    {
        $config = $this->resolveForProject($project);
        $schema = $config['schema'];

        $pdo = $this->connect($config['db_connection']);
        if (! $pdo) {
            return;
        }

        try {
            if (! preg_match('/^proj_[a-z0-9_]+$/i', $schema)) {
                return;
            }
            $this->exposeSchema($pdo, $schema, false);
            $pdo->exec("DROP SCHEMA IF EXISTS {$schema} CASCADE");
        } catch (Throwable $e) {
            Log::warning('SupabaseService: dropProjectSchema failed', [
                'project_id' => $project->id,
                'schema' => $schema,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Suspend/resume API access to a project's schema by toggling its PostgREST
     * exposure (suspend = unexpose). Data is retained. Safe no-op when unconfigured.
     */
    public function setProjectSchemaExposed(Project $project, bool $exposed): void
    {
        $config = $this->resolveForProject($project);
        $schema = $config['schema'];

        $pdo = $this->connect($config['db_connection']);
        if (! $pdo || ! preg_match('/^proj_[a-z0-9_]+$/i', $schema)) {
            return;
        }

        try {
            $this->exposeSchema($pdo, $schema, $exposed);
        } catch (Throwable $e) {
            Log::warning('SupabaseService: setProjectSchemaExposed failed', [
                'project_id' => $project->id,
                'exposed' => $exposed,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Add/remove a schema from PostgREST's instance-wide exposed list and reload.
     * Read-modify-write under a Postgres advisory lock so concurrent project
     * changes don't drop each other; read-back values are re-validated and the
     * list is single-quote-escaped before being written back.
     */
    protected function exposeSchema(PDO $pdo, string $schema, bool $add): void
    {
        // Serialize concurrent exposure changes (Cloud mode: many users at once).
        $pdo->exec('SELECT pg_advisory_lock(hashtext(\'webby.pgrst.db_schemas\'))');

        try {
            $row = $pdo->query("SELECT current_setting('pgrst.db_schemas', true) AS s")->fetch(PDO::FETCH_ASSOC);
            $current = trim((string) ($row['s'] ?? ''));
            $schemas = array_values(array_filter(array_map('trim', explode(',', $current))));

            // Re-validate every value read back from Postgres — a manually-set GUC
            // could contain hostile input. Only valid identifiers survive.
            $schemas = array_values(array_filter(
                $schemas,
                fn ($s) => (bool) preg_match('/^[a-z_][a-z0-9_]*$/i', $s)
            ));

            if ($schemas === []) {
                $schemas = ['public', 'graphql_public'];
            }

            if ($add && ! in_array($schema, $schemas, true)) {
                $schemas[] = $schema;
            } elseif (! $add) {
                $schemas = array_values(array_filter($schemas, fn ($s) => $s !== $schema));
            }

            // Escape single quotes defensively even though values are validated.
            $list = implode(',', array_map(fn ($s) => str_replace("'", "''", $s), $schemas));
            $pdo->exec("ALTER ROLE authenticator SET pgrst.db_schemas = '{$list}'");
            $pdo->exec("NOTIFY pgrst, 'reload config'");
            $pdo->exec("NOTIFY pgrst, 'reload schema'");
        } finally {
            $pdo->exec('SELECT pg_advisory_unlock(hashtext(\'webby.pgrst.db_schemas\'))');
        }
    }

    /**
     * Test a connection config (used by the admin "Test Connection" button).
     *
     * @param  array{url?:string,db_connection?:string}  $config
     * @return array{ok:bool,message:string}
     */
    public function testConnection(array $config): array
    {
        $dsn = (string) ($config['db_connection'] ?? '');

        // A missing driver has nothing to do with the connection string, so say
        // so plainly instead of sending the operator to re-check their URI.
        if (! $this->pgsqlDriverAvailable()) {
            return ['ok' => false, 'message' => __('PHP\'s PostgreSQL driver (pdo_pgsql) is not installed on this server. Install it, restart PHP, and try again.')];
        }

        $pdo = $this->connect($dsn);
        if (! $pdo) {
            return ['ok' => false, 'message' => __('Could not connect to the Supabase Postgres database. Check the connection string.')];
        }

        try {
            $pdo->query('SELECT 1');

            return ['ok' => true, 'message' => __('Supabase connection successful.')];
        } catch (Throwable $e) {
            // Don't echo raw PDO errors (may contain host/credentials) to the browser.
            Log::warning('SupabaseService: test query failed', ['error' => $e->getMessage()]);

            return ['ok' => false, 'message' => __('Connected, but the test query failed. Check the server logs for details.')];
        }
    }

    /** Whether PHP's pgsql PDO driver is loaded. Overridable seam for tests. */
    protected function pgsqlDriverAvailable(): bool
    {
        return in_array('pgsql', PDO::getAvailableDrivers(), true);
    }

    /** Open a PDO pgsql connection from a postgres:// URI. Returns null on failure/absence. */
    protected function connect(?string $uri): ?PDO
    {
        $uri = trim((string) $uri);
        if ($uri === '') {
            return null;
        }

        if (! $this->pgsqlDriverAvailable()) {
            Log::warning('SupabaseService: pdo_pgsql driver is not installed on this server');

            return null;
        }

        $parts = parse_url($uri);
        if ($parts === false || empty($parts['host'])) {
            // parse_url() rejects an unencoded "/", "?" or "#" in the password.
            Log::warning('SupabaseService: connection string could not be parsed');

            return null;
        }

        $host = $parts['host'];
        $port = (int) ($parts['port'] ?? 5432);
        $db = ltrim($parts['path'] ?? '/postgres', '/') ?: 'postgres';
        $user = isset($parts['user']) ? rawurldecode($parts['user']) : 'postgres';
        $pass = isset($parts['pass']) ? rawurldecode($parts['pass']) : '';

        // Harden against DSN injection: parse_url() does not sanitize the host,
        // so "h;options=..." style payloads could redirect the connection.
        if (! preg_match('/^[a-zA-Z0-9._-]+$/', $host) || $port < 1 || $port > 65535) {
            Log::warning('SupabaseService: rejected unsafe connection host/port');

            return null;
        }
        if (! preg_match('/^[a-zA-Z0-9._-]+$/', $db)) {
            return null;
        }

        // SSRF guard: BYOD connections point at the user's external Supabase
        // host — never at the platform's own network. Reject loopback, private,
        // and link-local (IMDS) targets so a crafted db_connection can't probe
        // or reach internal services. resolveSafeHost() returns the concrete
        // public IP to pin into the DSN (or null if blocked/unresolvable).
        $safeHost = $this->resolveSafeHost($host);
        if ($safeHost === null) {
            Log::warning('SupabaseService: rejected internal/loopback connection host');

            return null;
        }

        try {
            return new PDO(
                // The DSN pins the resolved IP (not the original hostname) so PDO
                // never performs its own second DNS lookup — this closes the
                // DNS-rebinding TOCTOU window between validation and connect.
                // connect_timeout bounds the TCP handshake — PDO::ATTR_TIMEOUT is
                // a statement timeout only for the pgsql driver, so a filtered
                // host would otherwise hang the worker until the OS TCP timeout.
                "pgsql:host={$safeHost};port={$port};dbname={$db};connect_timeout=8",
                $user,
                $pass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 8]
            );
        } catch (Throwable $e) {
            Log::warning('SupabaseService: PDO connect failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Resolve a connection host to a concrete public IP literal safe to pin into
     * the PDO DSN, or null if it is loopback/private/link-local, unresolvable, or
     * any of its DNS records points at a non-public address.
     *
     * Returning a resolved IP (rather than re-passing the hostname) prevents a
     * DNS-rebinding TOCTOU: PDO connects to exactly the address we validated and
     * does not perform its own second lookup. All A/AAAA records are checked so a
     * split/partial rebind can't slip one private record past validation.
     */
    private function resolveSafeHost(string $host): ?string
    {
        $h = strtolower($host);
        if (in_array($h, ['localhost', 'localhost.localdomain', 'ip6-localhost'], true)) {
            return null;
        }

        // A literal IP: validate and pin it directly.
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return $this->isPublicIp($host) ? $host : null;
        }

        // Resolve every A/AAAA record. Reject the host outright if ANY record is
        // non-public (defends against split-horizon / partial-rebind DNS).
        $ips = [];
        foreach (@dns_get_record($host, DNS_A | DNS_AAAA) ?: [] as $r) {
            $ip = $r['ip'] ?? ($r['ipv6'] ?? null);
            if ($ip !== null) {
                $ips[] = $ip;
            }
        }

        // Fallback for environments where dns_get_record is restricted.
        if ($ips === []) {
            $resolved = gethostbyname($host);
            if ($resolved !== $host) {
                $ips[] = $resolved;
            }
        }

        if ($ips === []) {
            return null; // unresolvable — reject rather than hand PDO a hostname.
        }
        foreach ($ips as $ip) {
            if (! $this->isPublicIp($ip)) {
                return null;
            }
        }

        return $ips[0];
    }

    /** True only for a public unicast IPv4/IPv6 address (no private/reserved/loopback/link-local). */
    private function isPublicIp(string $ip): bool
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }

            // RFC 6598 carrier-grade NAT (100.64.0.0/10) is NOT covered by
            // FILTER_FLAG_NO_RES_RANGE, so filter_var would accept it as public.
            // Reject it too — it targets carrier/cloud-internal networks.
            return ! $this->isCgnat($ip);
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return (bool) filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
        }

        return false;
    }

    /**
     * Reports whether an IPv4 literal is in the RFC 6598 shared address space
     * (100.64.0.0/10 — carrier-grade NAT), which PHP's filter_var reserved-range
     * flag does not exclude. Mirror in ShopifyService::isCgnat().
     */
    private function isCgnat(string $ip): bool
    {
        $parts = explode('.', $ip);
        if (count($parts) !== 4) {
            return false;
        }

        return (int) $parts[0] === 100 && (int) $parts[1] >= 64 && (int) $parts[1] <= 127;
    }
}
