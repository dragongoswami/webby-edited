<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ShopifyConnectionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'label' => 'My store',
            'shop_domain' => $this->faker->unique()->domainWord().'.myshopify.com',
            'access_token' => 'shpat_'.$this->faker->sha1(),
            'scope' => 'write_themes,read_themes',
            'status' => 'active',
        ];
    }
}
