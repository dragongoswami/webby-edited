<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockImage extends Model
{
    use HasFactory;

    protected $fillable = [
        'filename',
        'type',
        'subject',
        'category',
        'categories',
        'mood',
        'tone',
        'contrast',
    ];

    protected function casts(): array
    {
        return [
            'categories' => 'array',
        ];
    }
}
