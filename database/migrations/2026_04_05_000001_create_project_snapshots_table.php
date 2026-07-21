<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_snapshots')) {
            return;
        }

        Schema::create('project_snapshots', function (Blueprint $table) {
            $table->id();
            $table->uuid('project_id');
            $table->string('label');
            $table->unsignedInteger('file_count')->default(0);
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('snapshot_path');
            $table->timestamps();

            $table->foreign('project_id')
                ->references('id')
                ->on('projects')
                ->cascadeOnDelete();

            $table->index(['project_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_snapshots');
    }
};
