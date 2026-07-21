<?php

namespace Database\Factories;

use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Ticket>
 */
class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'project_id' => null,
            'subject' => fake()->sentence(6),
            'status' => Ticket::STATUS_OPEN,
            'assigned_admin_id' => null,
        ];
    }

    public function open(): static
    {
        return $this->state(fn () => ['status' => Ticket::STATUS_OPEN, 'closed_at' => null]);
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => Ticket::STATUS_PENDING, 'closed_at' => null]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => Ticket::STATUS_CLOSED, 'closed_at' => now()]);
    }
}
