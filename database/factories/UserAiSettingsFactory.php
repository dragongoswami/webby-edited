<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserAiSettings;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<UserAiSettings> */
class UserAiSettingsFactory extends Factory
{
    protected $model = UserAiSettings::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'preferred_provider' => 'system',
            'preferred_model' => null,
        ];
    }
}
