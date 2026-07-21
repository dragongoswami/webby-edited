<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'label',
        'file_count',
        'size_bytes',
        'snapshot_path',
    ];

    protected $casts = [
        'file_count' => 'integer',
        'size_bytes' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function getHumanReadableSize(): string
    {
        $bytes = $this->size_bytes;

        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1).' MB';
        }

        if ($bytes >= 1024) {
            return round($bytes / 1024, 1).' KB';
        }

        return $bytes.' B';
    }
}
