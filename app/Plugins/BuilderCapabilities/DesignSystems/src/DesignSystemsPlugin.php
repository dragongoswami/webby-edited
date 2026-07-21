<?php

namespace App\Plugins\BuilderCapabilities\DesignSystems;

use App\Contracts\Plugin;

class DesignSystemsPlugin implements Plugin
{
    public function __construct(private ?array $config = null) {}

    public function getName(): string
    {
        return 'Design Systems';
    }

    public function getDescription(): string
    {
        return 'Import and apply pre-built design systems to your AI-generated websites';
    }

    public function getType(): string
    {
        return 'builder_capability';
    }

    public function getIcon(): string
    {
        return 'Palette';
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
        return true;
    }

    public function validateConfig(array $config): void
    {
    }

    public function getConfigSchema(): array
    {
        return [];
    }
}