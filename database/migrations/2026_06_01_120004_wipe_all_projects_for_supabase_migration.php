<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * HISTORY (v1.1.0): this migration originally performed a DESTRUCTIVE wipe
     * of every project — the `projects` rows, their dependent child rows
     * (project_files / project_snapshots / project_shares / build_credit_usage),
     * detached tickets, and the on-disk preview/snapshot/published artifacts —
     * as part of the Firebase removal / Supabase migration.
     *
     * As of v1.2.2 that wipe is NEUTRALIZED. The Firebase -> Supabase schema
     * transition is handled entirely by the sibling migrations (120001 drops the
     * Firebase columns; 120006 and later add the nullable Supabase columns), so
     * deleting the project rows was never a schema requirement — it was a
     * one-time "clean slate" decision that cost every pre-1.1.0 install all of
     * its existing projects on upgrade.
     *
     * Two facts make changing this file safe:
     *  - Installs that ALREADY ran this migration (>=1.1.0) are unaffected:
     *    Laravel keys the `migrations` table by filename and will not re-run it,
     *    so the new no-op body never executes for them.
     *  - Installs still on a pre-1.1.0 version now KEEP their projects when they
     *    upgrade. Every column added to `projects` after this point is nullable
     *    or defaulted (supabase_schema, design_system_id, design_accent,
     *    supabase_connection_id, github_*, output_target='website'), so the
     *    preserved legacy rows remain valid. A project that relied on Firebase
     *    for dynamic data simply has no linked backend until the owner attaches
     *    a Supabase connection; the record, conversation history, preview files
     *    and rebuild/re-theme all survive.
     */
    public function up(): void
    {
        // Intentionally a no-op. This migration no longer deletes projects.
        // Do NOT reintroduce destructive data removal here — preventing the loss
        // of customer projects on upgrade is the entire reason this change exists.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op (this migration no longer changes data).
    }
};
