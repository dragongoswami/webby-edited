<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('builders', function (Blueprint $table) {
            if (!Schema::hasColumn('builders', 'ssh_host')) {
                $table->string('ssh_host')->nullable()->after('server_key');
            }
            if (!Schema::hasColumn('builders', 'ssh_user')) {
                $table->string('ssh_user')->default('root')->nullable()->after('ssh_host');
            }
            if (!Schema::hasColumn('builders', 'ssh_key_path')) {
                $table->string('ssh_key_path')->default('/root/.ssh/id_rsa')->nullable()->after('ssh_user');
            }
            if (!Schema::hasColumn('builders', 'builder_source_path')) {
                $table->string('builder_source_path')->default('/home/Builder')->nullable()->after('ssh_key_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('builders', function (Blueprint $table) {
            if (Schema::hasColumn('builders', 'ssh_host')) {
                $table->dropColumn('ssh_host');
            }
            if (Schema::hasColumn('builders', 'ssh_user')) {
                $table->dropColumn('ssh_user');
            }
            if (Schema::hasColumn('builders', 'ssh_key_path')) {
                $table->dropColumn('ssh_key_path');
            }
            if (Schema::hasColumn('builders', 'builder_source_path')) {
                $table->dropColumn('builder_source_path');
            }
        });
    }
};