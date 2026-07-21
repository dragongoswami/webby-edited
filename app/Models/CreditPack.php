<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CreditPack extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'credits',
        'bonus_credits',
        'price',
        'currency',
        'is_active',
        'is_popular',
        'sort_order',
    ];

    protected $casts = [
        'credits' => 'integer',
        'bonus_credits' => 'integer',
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'is_popular' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function getTotalCredits(): int
    {
        return (int) $this->credits + (int) $this->bonus_credits;
    }

    public function plans(): BelongsToMany
    {
        return $this->belongsToMany(Plan::class, 'credit_pack_plan');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order');
    }

    public function scopeAvailableToPlan(Builder $query, ?Plan $plan): Builder
    {
        return $query->where(function (Builder $q) use ($plan) {
            $q->whereDoesntHave('plans');
            if ($plan) {
                $q->orWhereHas('plans', fn (Builder $p) => $p->whereKey($plan->id));
            }
        });
    }

    public function isAvailableToPlan(?Plan $plan): bool
    {
        $this->loadMissing('plans');

        if ($this->plans->isEmpty()) {
            return true;
        }

        return $plan !== null && $this->plans->contains('id', $plan->id);
    }
}
