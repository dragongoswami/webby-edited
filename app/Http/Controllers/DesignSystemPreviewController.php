<?php

namespace App\Http\Controllers;

use App\Models\DesignSystem;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Serves a design system's bundled standalone styleguide demo (preview.html from
 * the system zip) for display in a sandboxed iframe on the design pickers
 * (Create page, in-editor Design panel) and Admin → Design Systems.
 *
 * The preview is self-contained (CSS inlined, only web fonts external). Two
 * transforms are applied to the served HTML:
 *   1. an in-memory localStorage/sessionStorage shim is injected so the demos'
 *      theme/accent toggle scripts don't throw in the sandboxed (opaque-origin)
 *      iframe, where touching real storage raises a SecurityError;
 *   2. when an ?accent= is supplied (and valid for the system), that accent's
 *      token map is injected as a late override so the preview re-themes to the
 *      user's chosen accent — otherwise the demo renders in its own default.
 */
class DesignSystemPreviewController extends Controller
{
    public function show(Request $request, DesignSystem $designSystem): Response
    {
        abort_unless($designSystem->status === 'active', 404);

        $html = $designSystem->previewHtml();
        if ($html === null) {
            $html = $this->stub($designSystem->name);
        } else {
            $accent = $request->query('accent');
            $accent = ($accent && in_array($accent, $designSystem->accents(), true)) ? $accent : null;
            $html = $this->injectStyles($this->injectHead($html, $designSystem, $accent), $designSystem, $accent);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
            // The demo inlines its styles and carries an inline light/dark switch
            // script, and pulls web fonts from Google. Framed only by our origin.
            'Content-Security-Policy' => "default-src 'none'; "
                ."img-src 'self' https: data:; "
                ."style-src 'unsafe-inline' https:; "
                .'font-src https: data:; '
                ."script-src 'unsafe-inline'; "
                ."frame-ancestors 'self'",
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }

    /**
     * Inject a runtime <script> as the first thing in <head> so it runs before the
     * demo's own scripts. It does two things:
     *   1. shims window.localStorage/sessionStorage with an in-memory store — in a
     *      `sandbox="allow-scripts"` iframe (no allow-same-origin) the document is
     *      an opaque origin where touching real storage throws, which would abort
     *      the demo's theme/accent init;
     *   2. when an accent is chosen, pre-seeds the demo's own accent key
     *      (`<slug>-accent`) so the demo applies that accent with its own accurate
     *      colors on init. Harmless no-op for demos that key off something else.
     */
    private function injectHead(string $html, DesignSystem $designSystem, ?string $accent): string
    {
        $seed = '';
        if ($accent !== null) {
            $key = json_encode($designSystem->slug.'-accent');
            $val = json_encode($accent);
            $seed = "try{window.localStorage.setItem({$key},{$val});}catch(e){}";
        }

        $shim = '<script>(function(){var mem=function(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null;},setItem:function(k,v){s[k]=String(v);},removeItem:function(k){delete s[k];},clear:function(){for(var k in s)delete s[k];},key:function(i){return Object.keys(s)[i]||null;},get length(){return Object.keys(s).length;}};};'
            ."['localStorage','sessionStorage'].forEach(function(n){var ok=false;try{window[n].getItem('__t');ok=true;}catch(e){}if(!ok){try{Object.defineProperty(window,n,{value:mem(),configurable:true});}catch(e){}}});"
            .$seed
            .'})();</script>';

        // preg_replace_callback (not preg_replace) so $-/\-sequences in $shim are
        // never interpreted as backreferences in the replacement.
        if (stripos($html, '<head>') !== false) {
            return preg_replace_callback('/<head>/i', fn ($m) => $m[0].$shim, $html, 1) ?? ($shim.$html);
        }

        return $shim.$html;
    }

    /**
     * Inject a late <style> just before </head> (so it wins over the demo's own
     * rules) carrying two things:
     *   1. a slim, theme-neutral scrollbar so the preview iframe doesn't show the
     *      chunky native OS scrollbar (semi-transparent grey reads on light + dark);
     *   2. when a valid accent is requested, overrides of the accent token vars
     *      (primary/ring/chart/sidebar*) for both light and dark so the demo
     *      re-themes to the chosen accent regardless of its own default.
     */
    private function injectStyles(string $html, DesignSystem $designSystem, ?string $accent): string
    {
        $css = 'html{scrollbar-width:thin;scrollbar-color:rgba(136,136,136,.4) transparent}'
            .'::-webkit-scrollbar{width:10px;height:10px}'
            .'::-webkit-scrollbar-track{background:transparent}'
            .'::-webkit-scrollbar-thumb{background:rgba(136,136,136,.4);border-radius:8px;border:2px solid transparent;background-clip:content-box}'
            .'::-webkit-scrollbar-thumb:hover{background:rgba(136,136,136,.6);background-clip:content-box}';

        if ($accent !== null) {
            $maps = $designSystem->resolveAccent($accent);
            $light = $this->cssVars($maps['light'] ?? []);
            $dark = $this->cssVars($maps['dark'] ?? []);
            $css .= ($light !== '' ? ":root{{$light}}" : '').($dark !== '' ? ".dark{{$dark}}" : '');
        }

        $style = '<style id="webby-preview-styles">'.$css.'</style>';

        // preg_replace_callback so $-/\-sequences in $style are never interpreted
        // as backreferences in the replacement.
        if (stripos($html, '</head>') !== false) {
            return preg_replace_callback('/<\/head>/i', fn ($m) => $style.$m[0], $html, 1) ?? ($html.$style);
        }

        return $html.$style;
    }

    /** Turn an accent map (var name => "H S% L%") into "--name:val !important;…". */
    private function cssVars(array $map): string
    {
        $out = '';
        foreach ($map as $name => $value) {
            if (! is_string($name) || ! is_string($value)) {
                continue;
            }
            $name = preg_replace('/[^a-z0-9-]/i', '', $name);
            // Whitelist only characters valid in a CSS colour token. This strips
            // <, >, ;, {, }, ", ', \, $ etc. so a hostile accents.json value can
            // never break out of the injected <style> (e.g. </style><script>…).
            $value = trim(preg_replace('/[^a-zA-Z0-9#%.,()\/+\s-]/', '', $value));
            if ($name !== '' && $value !== '') {
                $out .= "--{$name}:{$value} !important;";
            }
        }

        return $out;
    }

    private function stub(string $name): string
    {
        $name = e($name);

        return <<<HTML
        <!DOCTYPE html>
        <html lang="en"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{$name}</title>
        <style>
          html,body{height:100%;margin:0}
          body{display:flex;align-items:center;justify-content:center;
            font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
            color:#71717a;background:#fafafa;text-align:center;padding:2rem}
          @media (prefers-color-scheme:dark){body{color:#a1a1aa;background:#0a0a0a}}
        </style></head>
        <body><p>No preview is available for <strong>{$name}</strong>.</p></body></html>
        HTML;
    }
}
