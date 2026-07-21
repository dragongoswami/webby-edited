<?php

namespace App\Contracts;

/**
 * A plugin that supplies an S3-compatible object-storage destination for project
 * file-manager uploads. The generic upload/serve/quota logic lives in core
 * (App\Services\Storage\BucketStorageManager); a provider only declares how to
 * build its Flysystem disk and whether it can presign URLs.
 */
interface StorageProviderPlugin extends Plugin
{
    /**
     * Build the Laravel/Flysystem disk-config array (driver 's3') from the saved
     * plugin config. Derives endpoint / region / path-style / client options;
     * the whole array is passed to the AWS S3 client by the framework.
     *
     * @param  array<string,mixed>  $config  decrypted plugins.config
     * @return array<string,mixed>
     */
    public function diskConfig(array $config): array;

    /**
     * Whether objects can be served via presigned (temporaryUrl) URLs. When false,
     * core serves through the Laravel proxy route instead (e.g. Backblaze B2,
     * whose PHP-SDK presigned URLs are documented as incompatible).
     */
    public function supportsPresignedUrls(): bool;
}
