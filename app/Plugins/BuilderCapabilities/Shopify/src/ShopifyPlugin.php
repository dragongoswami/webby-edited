<?php

namespace App\Plugins\BuilderCapabilities;

use App\Contracts\Plugin;

class ShopifyPlugin implements Plugin
{
    public function __construct(private ?array $config = null) {}

    public function getName(): string
    {
        return 'Shopify';
    }

    public function getDescription(): string
    {
        return 'Generate Shopify OS 2.0 themes and connect to stores for auto-push';
    }

    public function getType(): string
    {
        return "builder_capability";
    }

    public function getIcon(): string
    {
        return "ShoppingBag";
    }

    public function getVersion(): string
    {
        return "1.0.0";
    }

    public function getAuthor(): string
    {
        return "Titan Systems";
    }

    public function getAuthorUrl(): string
    {
        return "https://titansys.dev";
    }

    public function isConfigured(): bool
    {
        return ! empty($this->config["shopify_api_key"]) && ! empty($this->config["shopify_api_secret"]) && ! empty($this->config["webhook_secret"]);
    }

    public function validateConfig(array $config): void
    {
        $required = ["shopify_api_key", "shopify_api_secret", "webhook_secret"];
        $missing = array_filter($required, fn ($k) => empty($config[$k]));

        if ($missing) {
            throw new \InvalidArgumentException(
                "Missing required Shopify credentials: " . implode(", ", $missing)
            );
        }

        if (isset($config["shopify_api_key"]) && ! str_starts_with($config["shopify_api_key"], "shp_")) {
            throw new \InvalidArgumentException("Shopify API key must start with 'shp_'");
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                "name" => "shopify_api_key",
                "label" => "Shopify API Key",
                "type" => "text",
                "required" => true,
                "placeholder" => "shp_...",
                "help" => "Found in your Shopify Partner Dashboard under Apps > your app > API credentials.",
            ],
            [
                "name" => "shopify_api_secret",
                "label" => "Shopify API Secret",
                "type" => "password",
                "required" => true,
                "sensitive" => true,
                "placeholder" => "Your API secret",
                "help" => "Found in your Shopify Partner Dashboard under Apps > your app > API credentials.",
            ],
            [
                "name" => "webhook_secret",
                "label" => "Webhook Secret",
                "type" => "password",
                "required" => true,
                "sensitive" => true,
                "placeholder" => "Your webhook secret",
                "help" => "Set a secret in your Shopify App webhook settings and paste it here for HMAC verification.",
            ],
            [
                "name" => "enable_store_connections",
                "label" => "Enable Store Connections (BYOS)",
                "type" => "toggle",
                "required" => false,
                "default" => true,
                "help" => "Allow users to connect their own Shopify stores via OAuth. Requires valid API credentials above.",
            ],
            [
                "name" => "webhook_url",
                "label" => "Webhook URL",
                "type" => "readonly",
                "default" => url("/api/shopify/webhook"),
                "help" => "Copy this URL and paste it in your Shopify App webhook settings for app/uninstalled and shop/update events.",
            ],
        ];
    }
}