<?php

namespace App\Console\Commands;

use App\Models\Builder;
use App\Models\Project;
use App\Models\Template;
use App\Models\User;
use App\Services\BuilderService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class PromptAbHarness extends Command
{
    protected $signature = 'prompt:ab {action : run or compare} {label?} {baseline?} {--log=/tmp/builder.log} {--user=1}';

    protected $description = 'Run the fixed 6-build A/B set for the system.md restructure and compare metric reports';

    /** Fixed build set — identical every run for comparability. */
    private array $builds = [
        ['name' => 'AB landing',   'template' => 'landing',   'prompt' => 'Build a landing page for a coffee shop called Bean and Brew'],
        ['name' => 'AB portfolio', 'template' => 'portfolio', 'prompt' => 'Build a portfolio website for a photographer named Maya Reyes'],
        ['name' => 'AB ecommerce', 'template' => 'ecommerce', 'prompt' => 'Build an e-commerce store for handmade candles called Lumen'],
        ['name' => 'AB dashboard', 'template' => 'dashboard', 'prompt' => 'Build an analytics dashboard for a SaaS product called Metricly'],
        ['name' => 'AB cms',       'template' => 'cms',       'prompt' => 'Build a personal tech blog called Bytes and Pieces'],
        ['name' => 'AB timer',     'template' => 'default',   'prompt' => 'Build a pomodoro focus timer app'],
    ];

    public function handle(BuilderService $svc): int
    {
        return $this->argument('action') === 'compare'
            ? $this->compareReports()
            : $this->runSet($svc);
    }

    private function runSet(BuilderService $svc): int
    {
        $label = $this->argument('label');
        if (! $label) {
            $this->error('run requires a <label>');

            return 1;
        }

        $user = User::findOrFail((int) $this->option('user'));
        $builder = $user->plan?->getBuilderWithFallbacks() ?? Builder::first();

        $results = [];
        foreach ($this->builds as $b) {
            $this->info("Building: {$b['name']} ...");
            $tpl = Template::where('slug', $b['template'])->first();
            $aiConfig = $svc->getAiConfigForUser($user);
            $aiConfig['agent']['remaining_build_credits'] = $user->getBuilderCreditLimit();

            $project = Project::create([
                'user_id' => $user->id,
                'name' => $b['name'],
                'initial_prompt' => $b['prompt'],
                'template_id' => $tpl?->id,
                'last_viewed_at' => now(),
            ]);
            $project->update(['build_status' => 'building', 'build_started_at' => now()]);
            $project->appendToHistory('user', $b['prompt']);
            $hist = $project->getHistoryForBuilderOptimized();

            $session = $svc->startSession($builder, $project, $b['prompt'], [], null, (string) $tpl?->id, $aiConfig, $hist);
            // Wire build_session_id — the completion webhook's SyncProjectBuildStatus
            // listener matches the project by build_session_id. Without this the
            // status never flips and the harness polls a stale "building" forever.
            $project->update(['builder_id' => $builder->id, 'build_session_id' => $session['session_id']]);

            // Poll until the build leaves the "building" state. Builds run
            // ~15-40 min; the deadline is a generous stuck-detector. If it
            // fires, cancel the build so it does NOT keep running concurrently
            // with the next one (concurrency corrupts the metrics).
            $deadline = now()->addMinutes(45);
            while (now()->lt($deadline) && $project->fresh()->build_status === 'building') {
                sleep(15);
            }
            if ($project->fresh()->build_status === 'building') {
                $this->warn("  {$b['name']} exceeded the deadline — cancelling so it doesn't pile up.");
                $this->stopBuild($builder, $project->id);
                sleep(5);
            }
            $results[$b['name']] = $this->collectMetrics($project->fresh());
        }

        $report = ['label' => $label, 'generated_at' => now()->toIso8601String(), 'builds' => $results];
        $dir = storage_path('prompt-ab');
        File::ensureDirectoryExists($dir);
        File::put("{$dir}/{$label}.json", json_encode($report, JSON_PRETTY_PRINT));
        $this->info("Report written: storage/prompt-ab/{$label}.json");
        $this->table(['Build', 'Status', 'Iter', 'Quality', 'mem.json', 'tpl-first'], $this->rows($results));

        return 0;
    }

    /** Collect metrics for one finished build from the DB, workspace, and builder log. */
    private function collectMetrics(Project $project): array
    {
        $wsPath = '/Users/noriellecruz/Web/webby-builder/storage/workspaces/'.$project->id;
        $log = File::exists($this->option('log'))
            ? preg_replace('/\e\[[0-9;]*m/', '', File::get($this->option('log')))
            : '';
        $sid = substr($project->id, 0, 8);
        $sessionLines = array_filter(explode("\n", $log), fn ($l) => str_contains($l, $sid));
        $sessionLog = implode("\n", $sessionLines);

        // First tool call = readFile("template.json")
        preg_match('/tool=(\w+)/', $sessionLog, $firstTool);
        $templateFirst = isset($firstTool[1]) && $firstTool[1] === 'readFile'
            && str_contains($sessionLog, 'template.json');

        // Quality issue count from "Quality checks completed (... issue_count=N)"
        preg_match('/issue_count=(\d+)/', $sessionLog, $qm);

        return [
            'status' => $project->build_status,
            'iterations' => substr_count($sessionLog, 'Calling AI provider'),
            'quality_issues' => isset($qm[1]) ? (int) $qm[1] : null,
            'memory_json' => File::exists("{$wsPath}/memory.json"),
            'template_json_first' => $templateFirst,
        ];
    }

    /** Cancel a still-running build via the builder's stop API (best-effort). */
    private function stopBuild(Builder $builder, string $sessionId): void
    {
        $base = rtrim($builder->url, '/');
        if ($builder->port) {
            $base .= ':'.$builder->port;
        }
        try {
            Http::withHeaders(['X-Server-Key' => $builder->server_key])
                ->timeout(15)
                ->post("{$base}/api/stop/{$sessionId}");
        } catch (\Throwable $e) {
            // Best-effort — if the stop call fails, metrics still record non-completed.
        }
    }

    private function rows(array $results): array
    {
        $rows = [];
        foreach ($results as $name => $m) {
            $rows[] = [$name, $m['status'], $m['iterations'], $m['quality_issues'] ?? '-',
                $m['memory_json'] ? 'yes' : 'no', $m['template_json_first'] ? 'yes' : 'no'];
        }

        return $rows;
    }

    /** Compare a candidate report against a baseline and print the pass verdict. */
    private function compareReports(): int
    {
        $label = $this->argument('label');
        $baseline = $this->argument('baseline');
        if (! $label || ! $baseline) {
            $this->error('compare requires <label> <baseline>');

            return 1;
        }
        $dir = storage_path('prompt-ab');
        $cand = json_decode(File::get("{$dir}/{$label}.json"), true);
        $base = json_decode(File::get("{$dir}/{$baseline}.json"), true);

        $hardFail = [];
        $candCompleted = $candTplFirst = $candMem = 0;
        $baseTplFirst = $baseMem = 0;
        $candIssues = $baseIssues = $candIter = $baseIter = 0;

        foreach ($cand['builds'] as $name => $m) {
            if ($m['status'] !== 'completed') {
                $hardFail[] = "{$name}: status={$m['status']}";
            } else {
                $candCompleted++;
            }
            $candTplFirst += $m['template_json_first'] ? 1 : 0;
            $candMem += $m['memory_json'] ? 1 : 0;
            $candIssues += $m['quality_issues'] ?? 0;
            $candIter += $m['iterations'];
        }
        foreach ($base['builds'] as $m) {
            $baseTplFirst += $m['template_json_first'] ? 1 : 0;
            $baseMem += $m['memory_json'] ? 1 : 0;
            $baseIssues += $m['quality_issues'] ?? 0;
            $baseIter += $m['iterations'];
        }

        // template-first IS deterministic (it's the first tool call) — strict.
        if ($candTplFirst < $baseTplFirst) {
            $hardFail[] = "template-first rate dropped: {$candTplFirst} < {$baseTplFirst}";
        }
        // memory.json write is a BEHAVIORAL metric, not deterministic: across
        // three runs of identical prompts it measured {3,4,3}/6, the variance
        // coming entirely from one build flipping. A strict `< baseline` gate
        // on a metric with proven ±1 noise spuriously fails ~half of no-op
        // changes. Hard-fail only on a real regression (drop ≥2); treat a
        // ±1 swing as noise and surface it as a soft note.
        $memDrop = $baseMem - $candMem;
        if ($memDrop >= 2) {
            $hardFail[] = "memory.json write rate dropped {$memDrop}: {$candMem} < {$baseMem}";
        }

        $this->info("Candidate '{$label}' vs baseline '{$baseline}':");
        $this->line("  completed: {$candCompleted}/6   template-first: {$candTplFirst}/6   memory.json: {$candMem}/6 (baseline {$baseMem}/6)");
        $this->line("  quality issues total: {$candIssues} (baseline {$baseIssues})");
        $this->line("  iterations total: {$candIter} (baseline {$baseIter})");

        if ($hardFail) {
            $this->error('HARD FAIL — revert this phase:');
            foreach ($hardFail as $f) {
                $this->error("  - {$f}");
            }

            return 1;
        }
        if ($candIssues > $baseIssues * 1.25 + 3) {
            $this->warn('SOFT: quality issues meaningfully up — investigate.');
        }
        if ($candIter > $baseIter * 1.2) {
            $this->warn('SOFT: iteration count meaningfully up — investigate.');
        }
        if ($memDrop === 1) {
            $this->warn('SOFT: memory.json down 1 — within the ±1 noise band, not a regression.');
        }
        $this->info('PASS — hard criteria hold.');

        return 0;
    }
}
