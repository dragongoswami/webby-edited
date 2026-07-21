<?php

return [

    // Requests per minute per API key on /api/v1 (the 'api-v1' rate limiter).
    'rate_limit_per_minute' => (int) env('API_V1_RATE_LIMIT', 60),

    // Maximum number of personal API keys a user may hold at once.
    'max_keys_per_user' => (int) env('API_MAX_KEYS_PER_USER', 10),

];
