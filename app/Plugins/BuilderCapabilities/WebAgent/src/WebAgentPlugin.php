<?php

namespace App\Plugins\BuilderCapabilities;

use App\Contracts\Plugin;

class WebAgentPlugin implements Plugin
{
    public function __construct(private ?array $config = null) {}

    public function getName(): string
    {
        return 'Web Agent';
    }

    public function getDescription(): string
    {
        return 'Enables the AI builder to fetch web content, browse pages, and scrape data using HTTP, headless browser, or Firecrawl';
    }

    public function getType(): string
    {
        return 'builder_capability';
    }

    public function getIcon(): string
    {
        return 'Globe';
    }

    public function getVersion(): string
    {
        return '1.0.0';
    }

    public function getAuthor(): string
    {
        return 'Titan Systems';
    }

    public function getAuthorUrl(): string
    {
        return 'https://titansys.dev';
    }

    public function isConfigured(): bool
    {
        return ! empty($this->config['firecrawl_api_key']);
    }

    public function validateConfig(array $config): void
    {
        $validModes = ['http', 'browser', 'firecrawl', 'smart'];
        
        if (isset($config['fetch_mode']) && ! in_array($config['fetch_mode'], $validModes, true)) {
            throw new \InvalidArgumentException(
                'Invalid fetch_mode. Must be one of: ' . implode(', ', $validModes)
            );
        }

        if (isset($config['firecrawl_api_key']) && ! empty($config['firecrawl_api_key'])) {
            if (! str_starts_with($config['firecrawl_api_key'], 'fc-')) {
                throw new \InvalidArgumentException('Firecrawl API key must start with "fc-"');
            }
        }

        $numericFields = [
            'max_actions_per_session' => [1, 200],
            'http_timeout_seconds' => [1, 60],
            'browser_action_timeout_seconds' => [1, 120],
            'max_response_size_mb' => [1, 50],
            'firecrawl_max_calls_per_session' => [1, 100],
        ];

        foreach ($numericFields as $field => [$min, $max]) {
            if (isset($config[$field])) {
                $val = (int) $config[$field];
                if ($val < $min || $val > $max) {
                    throw new \InvalidArgumentException(
                        "{$field} must be between {$min} and {$max}"
                    );
                }
            }
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                'name' => 'fetch_mode',
                'label' => 'Fetch Mode',
                'type' => 'select',
                'required' => true,
                'default' => 'http',
                'options' => [
                    ['value' => 'http', 'label' => 'HTTP Only (fast, no JS)'],
                    ['value' => 'browser', 'label' => 'Headless Browser (renders JS)'],
                    ['value' => 'firecrawl', 'label' => 'Firecrawl API (best for scraping)'],
                    ['value' => 'smart', 'label' => 'Smart (auto-escalates: HTTP -> Browser -> Firecrawl)'],
                ],
                'help' => 'How the AI builder fetches web content. "Smart" tries HTTP first, escalates to browser if blocked, then Firecrawl if both fail.',
            ],
            [
                'name' => 'max_actions_per_session',
                'label' => 'Max Browser Actions per Session',
                'type' => 'text',
                'required' => true,
                'default' => '50',
                'placeholder' => '50',
                'help' => 'Maximum number of browser actions (click, type, scroll, etc.) allowed in a single build session.',
            ],
            [
                'name' => 'http_timeout_seconds',
                'label' => 'HTTP Timeout (seconds)',
                'type' => 'text',
                'required' => true,
                'default' => '15',
                'placeholder' => '15',
                'help' => 'Timeout for HTTP fetch requests. Higher values for slow sites.',
            ],
            [
                'name' => 'browser_action_timeout_seconds',
                'label' => 'Browser Action Timeout (seconds)',
                'type' => 'text',
                'required' => true,
                'default' => '30',
                'placeholder' => '30',
                'help' => 'Timeout for individual browser actions (click, type, wait, etc.).',
            ],
            [
                'name' => 'max_response_size_mb',
                'label' => 'Max Response Size (MB)',
                'type' => 'text',
                'required' => true,
                'default' => '5',
                'placeholder' => '5',
                'help' => 'Maximum response size to accept from any fetch method. Larger responses are truncated.',
            ],
            [
                'name' => 'firecrawl_api_key',
                'label' => 'Firecrawl API Key',
                'type' => 'password',
                'required' => false,
                'sensitive' => true,
                'placeholder' => 'fc-...',
                'help' => 'Get your API key from https://firecrawl.dev. Required for "firecrawl" and "smart" fetch modes.',
            ],
            [
                'name' => 'firecrawl_max_calls_per_session',
                'label' => 'Max Firecrawl Calls per Session',
                'type' => 'text',
                'required' => true,
                'default' => '20',
                'placeholder' => '20',
                'help' => 'Hard limit on Firecrawl API calls per build session to control costs.',
            ],
        ];
    }
}