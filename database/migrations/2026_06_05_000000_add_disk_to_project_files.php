<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_files', function (Blueprint $table) {
            // Which filesystem disk this file is stored on: 'local' (default) or a
            // storage-provider plugin slug (e.g. 's3-aws'). Lets old local files keep
            // serving while new uploads land on the active provider's bucket.
            // Bounded to 32 to match ticket_attachments.disk (slugs are short).
            $table->string('disk', 32)->default('local')->after('path');
        });
    }

    public function down(): void
    {
        Schema::table('project_files', function (Blueprint $table) {
            $table->dropColumn('disk');
        });
    }
};
