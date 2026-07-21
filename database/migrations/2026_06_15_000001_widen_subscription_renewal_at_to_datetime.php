<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Widen subscriptions.renewal_at from TIMESTAMP to DATETIME.
     *
     * Lifetime plans store a renewal date 100 years out (the "effectively never"
     * sentinel used across the subscription/plan code). On MySQL the column was a
     * TIMESTAMP, whose range tops out at 2038-01-19, so persisting a ~2126 renewal
     * date threw SQLSTATE[22007] "Incorrect datetime value" and 500'd subscription
     * creation (TKT-000443). DATETIME spans years 1000-9999, so the sentinel fits.
     * renewal_at is the only date column that ever holds a far-future value
     * (starts_at/ends_at/etc. are always ~now).
     */
    public function up(): void
    {
        if (! Schema::hasTable('subscriptions') || ! Schema::hasColumn('subscriptions', 'renewal_at')) {
            return;
        }

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dateTime('renewal_at')->nullable()->change();
        });
    }

    /**
     * Reverse the migration — intentionally a no-op.
     *
     * Reverting DATETIME back to TIMESTAMP would throw SQLSTATE[22007] on MySQL for
     * any row whose renewal_at is beyond 2038 (e.g. lifetime subscriptions created
     * after this migration ran) — the very limitation this migration removes — and
     * abort the rollback partway. Leaving the column as DATETIME on rollback is
     * harmless: every value TIMESTAMP could hold also fits DATETIME, so the prior
     * code path keeps working. We therefore do not attempt the revert.
     */
    public function down(): void
    {
        // No-op by design (see docblock).
    }
};
