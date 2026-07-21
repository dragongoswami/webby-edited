<?php

namespace Database\Seeders;

use App\Models\StockImage;
use Illuminate\Database\Seeder;

class StockImageSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedDirectory('backgrounds', 'background');
        $this->seedDirectory('gallery', 'gallery');
    }

    private function seedDirectory(string $subdir, string $type): void
    {
        $path = storage_path("app/public/image-library/{$subdir}");

        if (! is_dir($path)) {
            return;
        }

        $files = array_diff(scandir($path), ['.', '..']);

        foreach ($files as $filename) {
            if (! preg_match('/\.(jpeg|jpg|png|webp)$/i', $filename)) {
                continue;
            }

            $meta = $type === 'background'
                ? $this->parseBackgroundFilename($filename)
                : $this->parseGalleryFilename($filename);

            StockImage::updateOrCreate(
                ['filename' => $filename],
                array_merge($meta, ['type' => $type])
            );
        }
    }

    /**
     * Parse background filename: bg_{subject}_{category}_{mood}_{tone}_{contrast}.jpeg
     */
    public function parseBackgroundFilename(string $filename): array
    {
        $name = preg_replace('/\.(jpeg|jpg|png|webp)$/i', '', $filename);
        $parts = explode('_', $name);

        // Expected: bg, subject, category, mood, tone, contrast (6+ parts)
        if (count($parts) < 6) {
            return [
                'subject' => $parts[1] ?? $name,
                'category' => $parts[2] ?? 'unknown',
                'categories' => [$parts[2] ?? 'unknown'],
                'mood' => $parts[3] ?? null,
                'tone' => $parts[4] ?? 'light',
                'contrast' => $parts[5] ?? 'dark-text',
            ];
        }

        $category = $parts[2];

        return [
            'subject' => $parts[1],
            'category' => $category,
            'categories' => [$category],
            'mood' => $parts[3],
            'tone' => $parts[4],
            'contrast' => $parts[5],
        ];
    }

    /**
     * Parse gallery filename: gal_{subject}_{categories}_{tone}_{contrast}.jpeg
     */
    public function parseGalleryFilename(string $filename): array
    {
        $name = preg_replace('/\.(jpeg|jpg|png|webp)$/i', '', $filename);
        $parts = explode('_', $name);

        // Expected: gal, subject, categories, tone, contrast (5+ parts)
        if (count($parts) < 5) {
            return [
                'subject' => $parts[1] ?? $name,
                'category' => $parts[2] ?? 'unknown',
                'categories' => explode('-', $parts[2] ?? 'unknown'),
                'mood' => null,
                'tone' => $parts[3] ?? 'light',
                'contrast' => $parts[4] ?? 'dark-text',
            ];
        }

        // Categories may span multiple underscore-delimited parts before tone/contrast
        // Tone is always second-to-last, contrast is always last
        $contrast = end($parts);
        $tone = $parts[count($parts) - 2];
        $categoryParts = array_slice($parts, 2, count($parts) - 4);
        $category = implode('_', $categoryParts);
        $categories = explode('-', $category);

        return [
            'subject' => $parts[1],
            'category' => $category,
            'categories' => $categories,
            'mood' => null,
            'tone' => $tone,
            'contrast' => $contrast,
        ];
    }
}
