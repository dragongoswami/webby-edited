<?php

namespace Database\Seeders;

use App\Helpers\CurrencyHelper;
use App\Models\CreditPack;
use Illuminate\Database\Seeder;

class CreditPackSeeder extends Seeder
{
    /**
     * Seed default credit packs (one-time top-ups). Credits are denominated in
     * tokens, matching plans' monthly_build_credits. Currency follows the
     * system default, like plans.
     */
    public function run(): void
    {
        $currency = CurrencyHelper::getCode();

        $packs = [
            [
                'name' => 'Starter Pack',
                'slug' => 'starter-pack',
                'description' => 'A small top-up to keep building when your monthly credits run low.',
                'credits' => 100000,
                'bonus_credits' => 0,
                'price' => 4.99,
                'currency' => $currency,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 1,
            ],
            [
                'name' => 'Booster Pack',
                'slug' => 'booster-pack',
                'description' => 'Our most popular top-up, with bonus credits included.',
                'credits' => 500000,
                'bonus_credits' => 50000,
                'price' => 19.99,
                'currency' => $currency,
                'is_active' => true,
                'is_popular' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Mega Pack',
                'slug' => 'mega-pack',
                'description' => 'Best value for power users — a large credit boost with extra bonus credits.',
                'credits' => 1500000,
                'bonus_credits' => 250000,
                'price' => 49.99,
                'currency' => $currency,
                'is_active' => true,
                'is_popular' => false,
                'sort_order' => 3,
            ],
        ];

        foreach ($packs as $packData) {
            CreditPack::firstOrCreate(
                ['slug' => $packData['slug']],
                $packData
            );
        }
    }
}
