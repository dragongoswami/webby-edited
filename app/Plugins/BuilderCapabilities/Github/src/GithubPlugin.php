<?php

namespace App\Plugins\BuilderCapabilities;

use App\Contracts\Plugin;

class GithubPlugin implements Plugin
{
    public function __construct(private ?array $config = null) {}

    public function getName(): string
    {
        return 'GitHub';
    }

    public function getDescription(): string
    {
        return 'Connect projects to GitHub repositories for auto-push and version control.';
    }

    public function getType(): string
    {
        return 'builder_capability';
    }

    public function getIcon(): string
    {
        return 'Github';
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
        return ! empty($this->config['app_id'])
            && ! empty($this->config['app_slug'])
            && ! empty($this->config['private_key'])
            && ! empty($this->config['client_id'])
            && ! empty($this->config['client_secret']);
    }

    public function validateConfig(array $config): void
    {
        $required = ['app_id', 'app_slug', 'private_key', 'client_id', 'client_secret'];
        $missing = array_filter($required, fn ($k) => empty($config[$k]));

        if ($missing) {
            throw new \InvalidArgumentException(
                'Missing required GitHub App credentials: '.implode(', ', $missing)
            );
        }

        $key = openssl_pkey_get_private($config['private_key']);

        if ($key === false) {
            throw new \InvalidArgumentException(
                'GitHub App private key is invalid: '.openssl_error_string()
            );
        }

        openssl_free_key($key);

        if (! is_numeric($config['app_id'])) {
            throw new \InvalidArgumentException('GitHub App ID must be numeric');
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                'name' => 'app_id',
                'label' => 'GitHub App ID',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'e.g. 123456',
                'help' => 'Found in your GitHub App settings under "About".',
            ],
            [
                'name' => 'app_slug',
                'label' => 'App Slug',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'my-webby-app',
                'help' => 'The URL-friendly name of your GitHub App. Used to build the install URL.',
            ],
            [
                'name' => 'private_key',
                'label' => 'Private Key (PEM)',
                'type' => 'textarea',
                'required' => true,
                'sensitive' => true,
                'rows' => 12,
                'placeholder' => "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
                'help' => 'Generate a private key in your GitHub App settings. The plugin signs App JWTs with this.',
            ],
            [
                'name' => 'client_id',
                'label' => 'Client ID',
                'type' => 'text',
                'required' => true,
                'placeholder' => 'Iv23li...',
                'help' => 'Found in your GitHub App settings. Used for OAuth user authorization.',
            ],
            [
                'name' => 'client_secret',
                'label' => 'Client Secret',
                'type' => 'password',
                'required' => true,
                'sensitive' => true,
                'placeholder' => 'Your client secret',
                'help' => 'Found in your GitHub App settings. Used for OAuth token exchange.',
            ],
            [
                'name' => 'webhook_secret',
                'label' => 'Webhook Secret',
                'type' => 'password',
                'required' => false,
                'sensitive' => true,
                'placeholder' => 'Optional webhook secret',
                'help' => 'Set a secret in your GitHub App webhook settings and paste it here. Required for install/uninstall webhook verification.',
            ],
            [
                'name' => 'webhook_url',
                'label' => 'Webhook URL',
                'type' => 'readonly',
                'default' => url('/api/github/webhook'),
                'help' => 'Copy this URL and paste it in your GitHub App webhook settings.',
            ],
        ];
    }
}