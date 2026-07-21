<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * DOM-based HTML sanitizer for user-supplied ticket bodies.
 *
 * The previous regex-based pass was fragile against:
 *   - unquoted event handlers   <p onmouseover=alert(1)>
 *   - control characters in href  <a href="\x01javascript:...">
 *   - newline-split schemes       <a href="java\nscript:...">
 *   - style="..." attributes       (CSS exfiltration / url())
 *   - HTML entity tricks            javascript&colon;...
 *
 * We now parse the body into a DOM, walk every element, and:
 *   - drop any tag not on the allowlist (children are preserved so text survives)
 *   - on each allowed tag, drop every attribute except a per-tag allowlist
 *   - normalize anchor `href` to http/https/mailto/tel only — anything else becomes "#"
 *   - force `rel="noopener noreferrer nofollow"` and `target="_blank"` on anchors
 */
class HtmlSanitizer
{
    private const ALLOWED_TAGS = [
        'p', 'br',
        'strong', 'b', 'em', 'i', 'u', 's',
        'ul', 'ol', 'li',
        'h2', 'h3',
        'blockquote',
        'code', 'pre',
        'a',
    ];

    private const ALLOWED_ATTRS = [
        'a' => ['href', 'rel', 'target'],
    ];

    private const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

    public static function clean(string $html): string
    {
        $trimmed = trim($html);
        if ($trimmed === '') {
            return '';
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        // Wrap in a root so loadHTML accepts fragments; declare UTF-8 to keep
        // multibyte chars intact (no <meta charset> trick which can mutate the tree).
        $dom->loadHTML(
            '<?xml encoding="UTF-8"?><div>'.$trimmed.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        libxml_clear_errors();

        $root = $dom->getElementsByTagName('div')->item(0);
        if (! $root) {
            return '';
        }

        self::walk($root);

        $out = '';
        foreach (iterator_to_array($root->childNodes) as $child) {
            $out .= $dom->saveHTML($child);
        }

        return trim($out);
    }

    private static function walk(DOMNode $node): void
    {
        // Iterate over a snapshot — we may replace/remove nodes during traversal.
        foreach (iterator_to_array($node->childNodes) as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }

            $tag = strtolower($child->nodeName);

            if (! in_array($tag, self::ALLOWED_TAGS, true)) {
                // Walk this subtree first to strip any nested disallowed nodes
                // (e.g. <svg><script>...) before we unwrap the current element.
                self::walk($child);
                self::unwrap($child);

                continue;
            }

            self::stripAttributes($child, $tag);
            self::walk($child);
        }
    }

    /**
     * Replace a disallowed element with the text/elements it directly contains,
     * dropping the tag (and its attributes/event handlers). For containers like
     * <script>/<style> whose text content is hostile we drop the whole element.
     */
    private static function unwrap(DOMElement $el): void
    {
        $parent = $el->parentNode;
        if (! $parent) {
            return;
        }

        $tag = strtolower($el->nodeName);
        $stripContent = in_array($tag, ['script', 'style', 'iframe', 'object', 'embed'], true);

        if (! $stripContent) {
            foreach (iterator_to_array($el->childNodes) as $child) {
                $parent->insertBefore($child, $el);
            }
        }

        $parent->removeChild($el);
    }

    private static function stripAttributes(DOMElement $el, string $tag): void
    {
        $allowed = self::ALLOWED_ATTRS[$tag] ?? [];

        foreach (iterator_to_array($el->attributes) as $attr) {
            $name = strtolower($attr->nodeName);
            if (! in_array($name, $allowed, true)) {
                $el->removeAttribute($attr->nodeName);
            }
        }

        if ($tag === 'a') {
            $href = $el->getAttribute('href');
            $el->setAttribute('href', self::safeHref($href));
            $el->setAttribute('rel', 'noopener noreferrer nofollow');
            $el->setAttribute('target', '_blank');
        }
    }

    private static function safeHref(string $href): string
    {
        if ($href === '') {
            return '#';
        }

        // Decode entities and strip control chars + all whitespace so we see the
        // real scheme, not a smuggled one. Anchor "#fragment" links remain valid.
        $decoded = html_entity_decode($href, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $normalized = preg_replace('/[\x00-\x20]+/', '', $decoded) ?? '';
        $lower = strtolower($normalized);

        if ($lower === '' || str_starts_with($lower, '#') || str_starts_with($lower, '/')) {
            return $href;
        }

        foreach (self::ALLOWED_SCHEMES as $scheme) {
            if (str_starts_with($lower, $scheme.':')) {
                return $href;
            }
        }

        return '#';
    }
}
