<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Ticket extends Model
{
    use HasFactory;

    public const STATUS_OPEN = 'open';

    public const STATUS_PENDING = 'pending';

    public const STATUS_CLOSED = 'closed';

    private const REFERENCE_PREFIX = 'TCK-';

    private const REFERENCE_LENGTH = 6;

    private const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const REFERENCE_MAX_ATTEMPTS = 20;

    /**
     * Generate a unique short reference for a new ticket.
     */
    public static function generateReference(): string
    {
        for ($i = 0; $i < self::REFERENCE_MAX_ATTEMPTS; $i++) {
            $candidate = self::REFERENCE_PREFIX.self::randomReferenceCode();
            if (! self::where('reference', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new \RuntimeException('Failed to generate unique ticket reference');
    }

    private static function randomReferenceCode(): string
    {
        $code = '';
        $max = strlen(self::REFERENCE_ALPHABET) - 1;
        for ($i = 0; $i < self::REFERENCE_LENGTH; $i++) {
            $code .= self::REFERENCE_ALPHABET[random_int(0, $max)];
        }

        return $code;
    }

    protected $fillable = [
        'reference',
        'user_id',
        'project_id',
        'subject',
        'status',
        'assigned_admin_id',
        'last_message_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_admin_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TicketMessage::class)->orderBy('created_at');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(TicketMessage::class)->latestOfMany();
    }
}
