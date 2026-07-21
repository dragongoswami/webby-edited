<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupabaseConnection extends Model
{
    protected $fillable = [
        'label',
        'url',
        'publishable_key',
        'secret_key',
        'db_connection',
        'last_tested_at',
    ];

    protected $hidden = ['secret_key', 'db_connection'];

    protected function casts(): array
    {
        return [
            'secret_key' => 'encrypted',
            'db_connection' => 'encrypted',
            'last_tested_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
