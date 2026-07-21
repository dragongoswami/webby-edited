<?php

namespace App\Services\Storage;

use App\Contracts\StorageProviderPlugin;
use App\Models\Plugin;
use App\Models\ProjectFile;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;

/**
 * Baked-in core for routing project file-manager storage to an active storage-
 * provider plugin's S3 bucket (or local when none is active). The s3 disk is
 * built at runtime from the plugin's decrypted config — credentials never touch
 * .env / config/filesystems.php.
 */
class BucketStorageManager
{
    private bool $activeResolved = false;

    private ?Plugin $activeProvider = null;

    /** @var array<string,bool> provider slugs already registered as runtime disks */
    private array $registered = [];

    /** @var array<string,?Plugin> slug → installed storage_provider plugin (or null) */
    private array $pluginCache = [];

    /**
     * The single active storage_provider plugin, or null when none is active.
     */
    public function activeProvider(): ?Plugin
    {
        if (! $this->activeResolved) {
            $this->activeProvider = Plugin::query()
                ->where('type', 'storage_provider')
                ->where('status', 'active')
                ->first();
            $this->activeResolved = true;
        }

        return $this->activeProvider;
    }

    /**
     * Disk name new uploads should be written to: the active provider's slug, or
     * 'local' when no provider is active. Registers the runtime disk as a side effect.
     */
    public function uploadDisk(): string
    {
        $provider = $this->activeProvider();

        if (! $provider) {
            return 'local';
        }

        $this->ensureRegistered($provider);

        return $provider->slug;
    }

    /**
     * Resolve a Filesystem for a stored file's disk name. Registers the s3 disk on
     * demand from the owning plugin's saved config; 'local' passes through.
     */
    public function disk(string $name): FilesystemAdapter
    {
        if ($name !== 'local') {
            $this->ensureRegisteredBySlug($name);
        }

        return Storage::disk($name);
    }

    /**
     * Whether files on the given disk are served via presigned URLs (vs proxy).
     */
    public function servesViaPresigned(string $disk): bool
    {
        if ($disk === 'local') {
            return false;
        }

        $instance = $this->pluginForSlug($disk)?->getInstance();

        return $instance instanceof StorageProviderPlugin
            && $instance->supportsPresignedUrls();
    }

    /**
     * A short-lived URL for a ProjectFile when its disk supports presigned URLs,
     * else null (caller falls back to proxy serving).
     */
    public function temporaryUrl(ProjectFile $file, \DateTimeInterface $expiresAt): ?string
    {
        return $this->temporaryUrlFor($file->disk ?: 'local', $file->getStoragePath(), $expiresAt);
    }

    /**
     * A short-lived URL for any disk + path when the disk supports presigned URLs,
     * else null. Generic primitive used by project files and ticket attachments.
     */
    public function temporaryUrlFor(string $disk, string $path, \DateTimeInterface $expiresAt): ?string
    {
        if (! $this->servesViaPresigned($disk)) {
            return null;
        }

        return $this->disk($disk)->temporaryUrl($path, $expiresAt);
    }

    private function ensureRegistered(Plugin $plugin): void
    {
        if (isset($this->registered[$plugin->slug])) {
            return;
        }

        $instance = $plugin->getInstance();

        if (! $instance instanceof StorageProviderPlugin) {
            throw new \RuntimeException("Plugin {$plugin->slug} is not a storage provider.");
        }

        config(["filesystems.disks.{$plugin->slug}" => $instance->diskConfig($plugin->config ?? [])]);
        $this->registered[$plugin->slug] = true;
    }

    private function ensureRegisteredBySlug(string $slug): void
    {
        if (isset($this->registered[$slug])) {
            return;
        }

        $plugin = $this->pluginForSlug($slug);

        if (! $plugin) {
            throw new \RuntimeException("Storage provider {$slug} is not installed.");
        }

        $this->ensureRegistered($plugin);
    }

    private function pluginForSlug(string $slug): ?Plugin
    {
        if (! array_key_exists($slug, $this->pluginCache)) {
            $this->pluginCache[$slug] = Plugin::query()
                ->where('type', 'storage_provider')
                ->where('slug', $slug)
                ->first();
        }

        return $this->pluginCache[$slug];
    }
}
