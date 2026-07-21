<?php

namespace App\Contracts;

interface Plugin
{
    /**
     * Get the plugin name.
     */
    public function getName(): string;

    /**
     * Get the plugin description.
     */
    public function getDescription(): string;

    /**
     * Get the plugin type (e.g., 'payment_gateway').
     */
    public function getType(): string;

    /**
     * Get the plugin icon name.
     *
     * Returns the name of a lucide-react icon component (e.g. "CreditCard",
     * "Wallet", "Globe"). The admin Plugins page maps this string to a
     * lucide component via the iconMap in resources/js/Pages/Admin/Plugins.tsx
     * — values not in the map fall back to the CreditCard icon, so add a new
     * iconMap entry when introducing a plugin that uses an unmapped icon.
     */
    public function getIcon(): string;

    /**
     * Get the plugin version.
     */
    public function getVersion(): string;

    /**
     * Get the plugin author.
     */
    public function getAuthor(): string;

    /**
     * Get the plugin author URL.
     */
    public function getAuthorUrl(): string;

    /**
     * Check if the plugin is properly configured.
     */
    public function isConfigured(): bool;

    /**
     * Validate the plugin configuration.
     *
     * @throws \Exception
     */
    public function validateConfig(array $config): void;

    /**
     * Get the configuration schema for the admin UI.
     * Returns an array defining the config fields.
     *
     * Each field should have:
     * - name: string (field key)
     * - label: string (display label)
     * - type: string (text, password, textarea, toggle, select)
     * - required: bool (optional)
     * - sensitive: bool (optional, for masking in UI)
     * - placeholder: string (optional)
     * - help: string (optional, help text)
     * - default: mixed (optional)
     * - options: array (optional, for select type)
     * - rows: int (optional, for textarea)
     */
    public function getConfigSchema(): array;
}
