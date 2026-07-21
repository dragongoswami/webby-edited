<?php

namespace App\Observers;

use App\Models\Plan;
use App\Services\CopyrightMarkService;

class PlanObserver
{
    /**
     * When a plan's White Label state or copyright text changes, drop the
     * published-site serve cache for every user on that plan so the copyright
     * badge reflects the new setting immediately (the cache is otherwise
     * mtime-based and only rebuilds on the next project build).
     */
    public function updated(Plan $plan): void
    {
        if ($plan->wasChanged('enable_white_label') || $plan->wasChanged('copyright_text')) {
            app(CopyrightMarkService::class)->forgetPublishedCacheForPlan($plan);
        }
    }
}
