<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Originally backfilled the `model_pricings` table from the MODEL_PRICING
     * constant. The Model Pricing feature has since been removed, so this
     * migration is now a no-op. It is retained only to preserve migration
     * history ordering on installs that already ran it.
     */
    public function up(): void
    {
        // No-op: the Model Pricing feature has been removed.
    }

    public function down(): void
    {
        // No-op.
    }
};
