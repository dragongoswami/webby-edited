<?php

namespace Database\Factories;

use App\Models\StockImage;
use Illuminate\Database\Eloquent\Factories\Factory;

class StockImageFactory extends Factory
{
    protected $model = StockImage::class;

    public function definition(): array
    {
        $subject = $this->faker->unique()->slug(2);
        $categories = [$this->faker->randomElement(['food', 'nature', 'craft', 'beauty', 'wellness'])];
        $categories[] = $this->faker->randomElement(['bakery', 'organic', 'artisan', 'retail', 'zen']);

        return [
            'filename' => 'gal_'.$subject.'_'.implode('-', $categories).'_light_dark-text.jpeg',
            'type' => 'gallery',
            'subject' => $subject,
            'category' => implode('-', $categories),
            'categories' => $categories,
            'mood' => null,
            'tone' => 'light',
            'contrast' => 'dark-text',
        ];
    }

    public function background(): static
    {
        return $this->state(function (array $attributes) {
            $subject = $this->faker->unique()->slug(2);
            $category = $this->faker->randomElement(['texture', 'gradient', 'atmosphere', 'abstract']);
            $mood = $this->faker->randomElement(['warm', 'cool', 'earthy', 'moody', 'soft', 'bold']);

            return [
                'filename' => 'bg_'.$subject.'_'.$category.'_'.$mood.'_light_dark-text.jpeg',
                'type' => 'background',
                'subject' => $subject,
                'category' => $category,
                'categories' => [$category],
                'mood' => $mood,
                'tone' => 'light',
                'contrast' => 'dark-text',
            ];
        });
    }

    public function gallery(): static
    {
        return $this->state(fn () => ['type' => 'gallery']);
    }
}
