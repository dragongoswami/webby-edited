<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Project;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

/**
 * Resolves the plan-gated copyright mark ("Made with …") applied to artifacts
 * that leave the platform: code exports, GitHub pushes, published sites, and
 * WordPress theme downloads. Plans with White Label produce no mark; a plan's
 * copyright_text overrides the default badge, which is built from the
 * configured site name (never a hardcoded brand — installs are white-labelable).
 *
 * Marking happens at egress time only — the builder workspace never contains
 * the mark, so plan changes take effect immediately and the AI agent can't
 * strip it from the source.
 */
class CopyrightMarkService
{
    private const START = '<!-- attribution:start -->';

    private const END = '<!-- attribution:end -->';

    /**
     * The mark for a project's owner, or null when the plan has White Label.
     *
     * @return array{html: string, comment: string}|null
     */
    public function markFor(Project $project): ?array
    {
        $plan = $project->user?->getCurrentPlan();
        if ($plan?->whitelabelEnabled()) {
            return null;
        }

        $siteName = SystemSetting::get('site_name', config('app.name'));
        $appUrl = (string) config('app.url');

        $custom = trim((string) ($plan?->copyright_text ?? ''));
        $html = $custom !== '' ? $this->sanitize($custom) : $this->defaultBadge($siteName, $appUrl);

        return [
            'html' => $html,
            'comment' => $this->commentSafe('© '.now()->year." · Built with {$siteName} ({$appUrl})"),
        ];
    }

    /**
     * Neutralize comment-terminator sequences so a crafted site_name can't
     * break out of the HTML (<!-- … -->) or CSS (/* … *‍/) comment it's
     * embedded in and inject live markup into exported/published artifacts.
     */
    private function commentSafe(string $text): string
    {
        return str_replace(['-->', '*/'], ['-- >', '* /'], $text);
    }

    /**
     * Inject the badge before </body>, replacing any previous attribution
     * block (idempotent — repeated injection or a plan-text change never
     * stacks a second badge).
     *
     * @param  array{html: string, comment: string}  $mark
     */
    public function injectHtml(string $html, array $mark): string
    {
        $block = self::START."\n".$mark['html']."\n".self::END;

        $pattern = '/'.preg_quote(self::START, '/').'.*?'.preg_quote(self::END, '/').'/s';
        if (preg_match($pattern, $html)) {
            return preg_replace($pattern, $block, $html);
        }

        if (str_contains($html, '</body>')) {
            return str_replace('</body>', "    {$block}\n  </body>", $html);
        }

        return $html."\n".$block."\n";
    }

    /**
     * Prepend the source comment banner (idempotent).
     *
     * @param  array{html: string, comment: string}  $mark
     */
    public function prependComment(string $html, array $mark): string
    {
        $banner = '<!-- '.$mark['comment'].' -->';
        if (str_contains($html, $banner)) {
            return $html;
        }

        return $banner."\n".$html;
    }

    /** Elements allowed in a plan's copyright badge. Everything else is unwrapped to its text. */
    private const ALLOWED_TAGS = ['a', 'span', 'div', 'p', 'strong', 'em', 'b', 'i', 'small', 'img', 'br'];

    /** Per-element attribute allowlist. URL attributes (href/src) are additionally scheme-checked. */
    private const ALLOWED_ATTRS = ['href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'id', 'style'];

    /** Elements whose contents are dropped entirely (not unwrapped) — they carry executable payloads. */
    private const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math', 'template', 'link', 'meta', 'base'];

    /**
     * Strip active content from plan-supplied badge HTML using a DOMDocument
     * allowlist (tags + attributes + URL schemes). The plan editor is
     * admin-only, but demo mode exposes admin publicly — unsanitized HTML here
     * would be stored XSS injected into every exported and published site. An
     * allowlist parse avoids the bypasses an attribute/regex blocklist misses
     * (e.g. `<svg/onload=>`, `formaction=`, unquoted/`data:` URLs).
     */
    public function sanitize(string $html): string
    {
        $html = mb_substr($html, 0, 1000);
        if (trim($html) === '') {
            return '';
        }

        $dom = new \DOMDocument;
        $loaded = @$dom->loadHTML(
            '<?xml encoding="UTF-8"?><div id="__sanitize_root">'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR | LIBXML_NOWARNING
        );
        if (! $loaded) {
            return ''; // unparseable → drop entirely rather than risk passing raw markup
        }

        $root = $dom->getElementById('__sanitize_root');
        if ($root === null) {
            return '';
        }

        $this->cleanChildren($root);

        $out = '';
        foreach (iterator_to_array($root->childNodes) as $child) {
            $out .= $dom->saveHTML($child);
        }

        return trim($out);
    }

    /** Recursively enforce the tag/attribute/scheme allowlist on a node's subtree. */
    private function cleanChildren(\DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof \DOMElement) {
                $tag = strtolower($child->tagName);

                if (in_array($tag, self::DROP_WITH_CONTENT, true)) {
                    $node->removeChild($child);

                    continue;
                }

                if (! in_array($tag, self::ALLOWED_TAGS, true)) {
                    // Unknown tag: unwrap — keep its (cleaned) children as text/markup, drop the tag.
                    $this->cleanChildren($child);
                    while ($child->firstChild) {
                        $node->insertBefore($child->firstChild, $child);
                    }
                    $node->removeChild($child);

                    continue;
                }

                $this->cleanAttributes($child);
                $this->cleanChildren($child);
            } elseif (! ($child instanceof \DOMText) && ! ($child instanceof \DOMCharacterData)) {
                // Comments, PIs, CDATA, etc. — drop.
                $node->removeChild($child);
            }
        }
    }

    /** Drop every attribute not on the allowlist; scheme-check URL attributes. */
    private function cleanAttributes(\DOMElement $el): void
    {
        foreach (iterator_to_array($el->attributes) as $attr) {
            $name = strtolower($attr->name);

            if (! in_array($name, self::ALLOWED_ATTRS, true)) {
                $el->removeAttribute($attr->name);

                continue;
            }

            if (($name === 'href' || $name === 'src') && ! $this->isSafeUrl($attr->value)) {
                $el->setAttribute($attr->name, '#');
            }

            if ($name === 'style' && preg_match('/expression\s*\(|javascript:|url\s*\(\s*["\']?\s*javascript:/i', $attr->value)) {
                $el->removeAttribute($attr->name);
            }
        }
    }

    /** Allow only http(s)/mailto and relative/anchor URLs; reject javascript:, data:, vbscript:, etc. */
    private function isSafeUrl(string $url): bool
    {
        $url = trim(preg_replace('/[\x00-\x20]/', '', $url));
        if (preg_match('/^([a-z][a-z0-9+.\-]*):/i', $url, $m)) {
            return in_array(strtolower($m[1]), ['http', 'https', 'mailto'], true);
        }

        return true; // relative path or #anchor
    }

    /**
     * Drop the published-site serve cache for every project the user owns so
     * the next request re-renders with the user's current plan's marking
     * state. Called from the plan-change observers.
     */
    public function forgetPublishedCacheFor(User $user): void
    {
        foreach ($user->projects()->pluck('id') as $projectId) {
            Storage::disk('local')->deleteDirectory("published/{$projectId}");
        }
    }

    /**
     * Drop the published-site serve cache for every user effectively on a plan
     * — both those assigned via plan_id and those on an active subscription —
     * so editing the plan's White Label / copyright_text takes effect on the
     * next request without waiting for a rebuild. Called from PlanObserver.
     */
    public function forgetPublishedCacheForPlan(Plan $plan): void
    {
        $userIds = $plan->users()->pluck('users.id')
            ->merge($plan->subscriptions()->where('status', 'active')->pluck('user_id'))
            ->unique();

        foreach ($userIds as $userId) {
            $projectIds = Project::where('user_id', $userId)->pluck('id');
            foreach ($projectIds as $projectId) {
                Storage::disk('local')->deleteDirectory("published/{$projectId}");
            }
        }
    }

    /** Fixed bottom-right pill, inline styles only (no CSS dependency). */
    private function defaultBadge(string $siteName, string $appUrl): string
    {
        $name = e($siteName);
        $url = e($appUrl);

        return '<a href="'.$url.'" target="_blank" rel="noopener" '
            .'style="position:fixed;bottom:12px;right:12px;z-index:2147483647;'
            .'background:rgba(17,17,17,.85);color:#fff;font:500 12px/1 system-ui,sans-serif;'
            .'padding:7px 12px;border-radius:9999px;text-decoration:none;opacity:.85">'
            .'Made with '.$name.'</a>';
    }
}
