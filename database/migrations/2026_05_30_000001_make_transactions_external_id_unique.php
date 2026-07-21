<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            // Drop the existing non-unique index if present, then add a unique one.
            try {
                $table->dropIndex(['external_transaction_id']);
            } catch (Throwable $e) {
                // index may not exist under that name; ignore
            }
            $table->unique('external_transaction_id');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique(['external_transaction_id']);
            $table->index('external_transaction_id');
        });
    }
};
