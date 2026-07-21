<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketAttachment extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'ticket_message_id',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size_bytes',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'size_bytes' => 'integer',
        ];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(TicketMessage::class, 'ticket_message_id');
    }

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (self $m) {
            if (! $m->created_at) {
                $m->created_at = now();
            }
        });
    }
}
