<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GithubConnection extends Model
{
    protected $fillable = [
        'user_id',
        'label',
        'github_login',
        'account_type',
        'installation_id',
        'user_access_token',
        'user_token_expires_at',
        'user_refresh_token',
        'scopes',
        'status',
        'last_used_at',
    ];

    protected $hidden = ['user_access_token', 'user_refresh_token'];

    protected function casts(): array
    {
        return [
            'user_access_token' => 'encrypted',
            'user_refresh_token' => 'encrypted',
            'user_token_expires_at' => 'datetime',
            'last_used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'github_connection_id');
    }
}
