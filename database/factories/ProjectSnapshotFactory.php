<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectSnapshot;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProjectSnapshotFactory extends Factory
{
    protected $model = ProjectSnapshot::class;

    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'label' => 'Pre-publish snapshot',
            'file_count' => $this->faker->numberBetween(1, 50),
            'size_bytes' => $this->faker->numberBetween(1024, 5242880),
            'snapshot_path' => 'snapshots/'.$this->faker->uuid().'/'.now()->timestamp,
        ];
    }
}
