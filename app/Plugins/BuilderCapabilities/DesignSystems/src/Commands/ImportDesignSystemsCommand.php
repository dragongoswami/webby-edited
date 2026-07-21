<?php

namespace App\Plugins\BuilderCapabilities\DesignSystems\src\Commands;

use App\Models\DesignSystem;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use ZipArchive;

class ImportDesignSystemsCommand extends Command
{
    protected $signature = 'design-systems:import {--force : Force re-import of all design systems}';

    protected $description = 'Import design systems from plugin resources into database';

    public function handle(): int
    {
        $resourcePath = dirname(__DIR__, 3) . '/Resources/design-systems';

        if (!is_dir($resourcePath)) {
            $this->error("Design systems resource directory not found: {$resourcePath}");
            $this->info('Add design systems to: ' . $resourcePath);
            return 1;
        }

        $directories = File::directories($resourcePath);

        if (empty($directories)) {
            $this->warn('No design system directories found in resources');
            $this->info('Add design systems to: ' . $resourcePath);
            return 0;
        }

        $this->info("Found " . count($directories) . " design systems to import");

        if ($this->option('force')) {
            $this->warn('Re-importing all design systems (--force flag)');
        } else {
            $existing = DesignSystem::count();
            if ($existing > 0) {
                $this->info("{$existing} design systems already exist. Use --force to re-import.");
            }
        }

        $count = 0;
        $errors = [];

        foreach ($directories as $dir) {
            $slug = basename($dir);
            $designMdPath = $dir . '/DESIGN.md';

            if (!File::exists($designMdPath)) {
                $errors[] = "{$slug}: Missing DESIGN.md";
                continue;
            }

            try {
                $content = File::get($designMdPath);
                $meta = $this->parseDesignMd($content, $slug);

                if ($this->option('force')) {
                    $existing = DesignSystem::where('slug', $slug)->first();
                    if ($existing) {
                        Storage::disk('local')->delete($existing->zip_path);
                        $existing->delete();
                    }
                } else {
                    if (DesignSystem::where('slug', $slug)->exists()) {
                        $this->line("Skipping {$meta['name']}: already exists");
                        continue;
                    }
                }

                $zipPath = $this->createZip($dir, $slug, $meta);

                $system = DesignSystem::create([
                    'slug' => $slug,
                    'name' => $meta['name'],
                    'description' => $meta['description'],
                    'when_to_use' => $meta['when_to_use'],
                    'zip_path' => $zipPath,
                    'version' => $meta['version'],
                    'author' => $meta['author'],
                    'is_default' => $count === 0 && $slug === 'terracotta-editor',
                    'status' => 'active',
                ]);

                $this->line("Imported: {$meta['name']} ({$slug})" . ($system->is_default ? ' [DEFAULT]' : ''));
                $count++;
            } catch (\Exception $e) {
                $errors[] = "{$slug}: " . $e->getMessage();
            }
        }

        $this->newLine();
        $this->info("Successfully imported {$count} design systems");

        if (!empty($errors)) {
            $this->warn("Errors:");
            foreach ($errors as $error) {
                $this->line("  - {$error}");
            }
        }

        return empty($errors) ? 0 : 1;
    }

    private function parseDesignMd(string $content, string $defaultSlug): array
    {
        $lines = explode("\n", $content);
        $name = $this->generateName($defaultSlug);
        $description = null;
        $whenToUse = null;
        $version = '1.0.0';
        $author = 'Imported from awesome-design-md';

        foreach ($lines as $line) {
            $line = trim($line);

            if (preg_match('/^#\s+(.+)$/', $line, $matches)) {
                $potentialName = trim($matches[1]);
                if (strlen($potentialName) > 2 && strlen($potentialName) < 60) {
                    $name = $this->generateName($potentialName);
                }
            }

            if (preg_match('/Mood:\s*(.+)/i', $line, $matches)) {
                $description = trim($matches[1]);
            }
            if (preg_match('/Aesthetic Direction:\s*(.+)/i', $line, $matches)) {
                $description = ($description ? $description . '. ' : '') . trim($matches[1]);
            }
        }

        $description = $description ?: "A design system imported from awesome-design-md repository";

        return [
            'name' => $name,
            'description' => $description,
            'when_to_use' => "Use when you want a website with this visual style: {$name}",
            'version' => $version,
            'author' => $author,
        ];
    }

    private function generateName(string $original): string
    {
        $adjectives = [
            'modern', 'minimal', 'bold', 'vibrant', 'elegant', 'sleek', 'dynamic',
            'classic', 'premium', 'playful', 'creative', 'artistic', 'refined',
        ];

        $nouns = [
            'canvas', 'studio', 'palette', 'style', 'vision', 'aesthetic', 'theme',
            'look', 'feel', 'spirit', 'essence', 'flow', 'vibe', 'form', 'core',
        ];

        $adjIndex = abs(crc32($original)) % count($adjectives);
        $nounIndex = abs(crc32($original . 'noun')) % count($nouns);

        $adjective = $adjectives[$adjIndex];
        $noun = $nouns[$nounIndex];

        return ucfirst($adjective) . ' ' . ucfirst($noun);
    }

    private function createZip(string $dir, string $slug, array $meta): string
    {
        $zipFileName = $slug . '.zip';
        $tempPath = storage_path('app/temp/' . $zipFileName);
        $finalPath = 'design-systems/' . $zipFileName;

        if (!is_dir(dirname($tempPath))) {
            mkdir(dirname($tempPath), 0755, true);
        }

        $zip = new ZipArchive();
        if ($zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \Exception("Cannot create zip: {$tempPath}");
        }

        $designMdContent = File::get($dir . '/DESIGN.md');

        $zip->addFromString('design.json', json_encode([
            'name' => $meta['name'],
            'slug' => $slug,
            'version' => $meta['version'],
            'author' => $meta['author'],
            'description' => $meta['description'],
            'when_to_use' => $meta['when_to_use'],
        ], JSON_PRETTY_PRINT));

        $tokensCss = $this->generateTokensCss($designMdContent);
        $zip->addFromString('tokens.css', $tokensCss);

        $accentsJson = json_encode([
            'default' => 'Primary accent color',
            'warm' => 'Warm toned accent',
            'cool' => 'Cool toned accent',
        ], JSON_PRETTY_PRINT);
        $zip->addFromString('accents.json', $accentsJson);

        $zip->addFromString('DESIGN.md', $designMdContent);

        $previewHtmlPath = $dir . '/preview.html';
        if (File::exists($previewHtmlPath)) {
            $zip->addFromString('preview.html', File::get($previewHtmlPath));
        }

        $zip->close();

        Storage::disk('local')->put($finalPath, file_get_contents($tempPath));
        unlink($tempPath);

        return $finalPath;
    }

    private function generateTokensCss(string $designMdContent): string
    {
        $css = ":root {\n";

        if (preg_match('/--color-primary:\s*([^;]+);/', $designMdContent, $matches)) {
            $css .= "  --color-primary: " . trim($matches[1]) . ";\n";
        } else {
            $colors = $this->extractColors($designMdContent);
            $css .= "  --color-primary: #{$colors['primary']};\n";
            $css .= "  --color-primary-hover: #{$colors['primary_hover']};\n";
            $css .= "  --color-bg: #{$colors['bg']};\n";
            $css .= "  --color-text: #{$colors['text']};\n";
            $css .= "  --color-surface: #{$colors['surface']};\n";
            $css .= "  --color-border: #{$colors['border']};\n";
        }

        $css .= "  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;\n";
        $css .= "  --font-serif: 'Fraunces', Georgia, serif;\n";

        $css .= "}\n";
        return $css;
    }

    private function extractColors(string $content): array
    {
        $hash = crc32($content);
        $h = $hash % 360;
        $s = 50 + ($hash % 30);
        $l = 40 + ($hash % 20);

        return [
            'primary' => sprintf('%02X%02X%02X', hslToRgb($h / 360, $s / 100, $l / 100)),
            'primary_hover' => sprintf('%02X%02X%02X', hslToRgb($h / 360, $s / 100, max(0, $l / 100 - 0.1))),
            'bg' => 'FAFAF8',
            'text' => '1A1A1A',
            'surface' => 'FFFFFF',
            'border' => 'E8E6E3',
        ];
    }
}

function hslToRgb(float $h, float $s, float $l): array
{
    $v = $l <= 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
    if ($v === 0) {
        return [0, 0, 0];
    }
    $a = 2 * $l - $v;

    return [
        round(255 * hueToRgb($a, $v, $h + 1 / 3)),
        round(255 * hueToRgb($a, $v, $h)),
        round(255 * hueToRgb($a, $v, $h - 1 / 3)),
    ];
}

function hueToRgb(float $a, float $b, float $c): float
{
    if ($c < 0) {
        $c += 1;
    }
    if ($c > 1) {
        $c -= 1;
    }
    if ($c < 1 / 6) {
        return $a + ($b - $a) * 6 * $c;
    }
    if ($c < 1 / 2) {
        return $b;
    }
    if ($c < 2 / 3) {
        return $a + ($b - $a) * (2 / 3 - $c) * 6;
    }
    return $a;
}