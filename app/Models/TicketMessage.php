<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TicketMessage extends Model
{
    use HasFactory;

    protected $fillable = ['ticket_id', 'user_id', 'body'];

    protected $appends = ['body_preview'];

    /**
     * Plain-text preview of the body, stripped of HTML and truncated.
     * Used by the inbox snippet so we don't ship the full HTML body
     * (which can be hundreds of KB) just to render a 100-char hint.
     *
     * Order matters: decode entities BEFORE stripping tags so a body that
     * stored escaped tag syntax (e.g. user typed "<script>" as text and
     * the HTML serializer wrote &lt;script&gt;) is reduced to plain text
     * instead of producing live HTML if the value is ever rendered as raw
     * HTML by a future consumer.
     */
    public function getBodyPreviewAttribute(): string
    {
        $decoded = html_entity_decode((string) $this->body, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim(strip_tags($decoded));
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return mb_substr($text, 0, 120);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class);
    }
}
