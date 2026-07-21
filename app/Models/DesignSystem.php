<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;

class DesignSystem extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'when_to_use',
        'zip_path',
        'version',
        'author',
        'is_default',
        'status',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }

    public static function findBySlug(string $slug): ?self
    {
        return static::where('slug', $slug)->first();
    }

    public function hasPreview(): bool
    {
        if (!$this->zip_path) {
            return false;
        }

        $zipPath = Storage::disk('local')->path($this->zip_path);
        if (!is_file($zipPath)) {
            return false;
        }

        $zip = new \ZipArchive;
        if ($zip->open($zipPath) !== true) {
            return false;
        }

        $hasPreview = $zip->locateName('preview.html') !== false;
        $zip->close();

        return $hasPreview;
    }

    public function getPreviewUrl(): ?string
    {
        if (!$this->hasPreview()) {
            return null;
        }

        return route('design-systems.preview', $this->slug);
    }
}