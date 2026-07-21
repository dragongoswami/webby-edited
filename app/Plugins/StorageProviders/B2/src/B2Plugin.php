<?php

namespace App\Plugins\StorageProviders\B2;

use App\Contracts\StorageProviderPlugin;

class B2Plugin implements StorageProviderPlugin
{
    public function __construct(private ?array $config = null) {}

    public function getName(): string
    {
        return 'Backblaze B2';
    }

    public function getDescription(): string
    {
        return 'Cloud storage via Backblaze B2 S3-compatible API. Store project files securely and affordably.';
    }

    public function getType(): string
    {
        return 'storage_provider';
    }

    public function getIcon(): string
    {
        return 'HardDrive';
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
        if ($this->config === null) {
            return false;
        }

        return !empty($this->config['key_id'])
            && !empty($this->config['key'])
            && !empty($this->config['bucket'])
            && !empty($this->config['endpoint'])
            && !empty($this->config['region']);
    }

    public function validateConfig(array $config): void
    {
        if (empty($config['key_id'])) {
            throw new \InvalidArgumentException('Key ID is required');
        }
        if (empty($config['key'])) {
            throw new \InvalidArgumentException('Application Key is required');
        }
        if (empty($config['bucket'])) {
            throw new \InvalidArgumentException('Bucket name is required');
        }
        if (empty($config['endpoint'])) {
            throw new \InvalidArgumentException('Endpoint is required');
        }
        if (empty($config['region'])) {
            throw new \InvalidArgumentException('Region is required');
        }

        if (!str_starts_with($config['endpoint'], 's3.')) {
            throw new \InvalidArgumentException(
                'Endpoint must be an S3-compatible endpoint (e.g., s3.us-west-000.backblazeb2.com)'
            );
        }
    }

    public function getConfigSchema(): array
    {
        return [
            [
                'key' => 'key_id',
                'label' => 'Key ID',
                'type' => 'text',
                'required' => true,
                'help' => 'Found in your B2 account under Application Keys',
                'placeholder' => 'Your B2 application key ID (e.g., 0042...)',
            ],
            [
                'key' => 'key',
                'label' => 'Application Key',
                'type' => 'password',
                'required' => true,
                'help' => 'The application key secret',
                'placeholder' => 'Your B2 application key',
            ],
            [
                'key' => 'bucket',
                'label' => 'Bucket Name',
                'type' => 'text',
                'required' => true,
                'help' => 'The B2 bucket to store files in',
                'placeholder' => 'e.g., my-webby-files',
            ],
            [
                'key' => 'endpoint',
                'label' => 'Endpoint',
                'type' => 'text',
                'required' => true,
                'help' => 'S3-compatible endpoint from B2 (found in bucket settings)',
                'placeholder' => 'e.g., s3.us-west-000.backblazeb2.com',
            ],
            [
                'key' => 'region',
                'label' => 'Region',
                'type' => 'text',
                'required' => true,
                'help' => 'B2 region (e.g., us-west-000)',
                'placeholder' => 'e.g., us-west-000',
            ],
        ];
    }

    public function diskConfig(array $config): array
    {
        return [
            'driver' => 's3',
            'key' => $config['key_id'],
            'secret' => $config['key'],
            'bucket' => $config['bucket'],
            'endpoint' => 'https://' . $config['endpoint'],
            'region' => $config['region'],
            'url' => 'https://' . $config['endpoint'] . '/files/' . $config['bucket'],
            'use_path_style_endpoint' => true,
            'throw' => false,
            'cache' => [
                'store' => 'file',
            ],
        ];
    }

    public function supportsPresignedUrls(): bool
    {
        return false;
    }
}