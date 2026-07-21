<?php

namespace App\Plugins\BuilderCapabilities;

use App\Contracts\Plugin;

class WordPressPlugin implements Plugin
{
    public function __construct(private ?array $config = null) {}

    public function getName(): string
    {
        return 'WordPress';
    }

    public function getDescription(): string
    {
        return 'Generate installable WordPress block themes from AI builds';
    }

    public function getType(): string
    {
        return 'builder_capability';
    }

    public function getIcon(): string
    {
        return 'FileCode';
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
        return true; // WordPress needs no external credentials
    }

    public function validateConfig(array $config): void
    {
        // No configuration required for WordPress capability
    }

    public function getConfigSchema(): array
    {
        return [];
    }
}