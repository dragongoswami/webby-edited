<?php

namespace App\Http\Controllers;

use App\Models\Template;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TemplateApiController extends Controller
{
    /**
     * List all available templates for the builder.
     *
     * @authenticated
     */
    public function index(Request $request): JsonResponse
    {
        // Scope to the build's output target so a WordPress build never sees
        // React templates (and vice-versa). Absent param = website (back-compat
        // with builders that don't send it).
        $outputTarget = $request->query('output_target', 'website');
        if (! in_array($outputTarget, ['website', 'wordpress_theme', 'shopify_theme'], true)) {
            $outputTarget = 'website';
        }

        $templates = Template::query()
            ->where('output_target', $outputTarget)
            ->select('id', 'slug', 'name', 'description', 'category')
            ->latest()
            ->get();

        return response()->json([
            'templates' => $templates->map(fn ($t) => [
                'id' => (string) $t->id,
                'name' => $t->name,
                'description' => $t->description,
                'category' => $t->category,
            ]),
        ]);
    }

    /**
     * Get detailed metadata about a specific template.
     *
     * @authenticated
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $template = $this->resolveTemplate($id, $request->query('output_target'));

        // If metadata is stored, return it; otherwise return basic info
        $metadata = $template->metadata ?? $this->getDefaultMetadata($template);

        return response()->json($metadata);
    }

    /**
     * Download a template as a zip file.
     *
     * @authenticated
     */
    public function download(Request $request, string $id): BinaryFileResponse|StreamedResponse|JsonResponse
    {
        $template = $this->resolveTemplate($id, $request->query('output_target'));

        if (! $template->zip_path) {
            return response()->json([
                'error' => 'Template file not available',
            ], 404);
        }

        if (! file_exists($template->zip_path)) {
            return response()->json([
                'error' => 'Template file not found',
            ], 404);
        }

        return response()->download($template->zip_path, "{$template->slug}-template.zip");
    }

    /**
     * Resolve a template by integer ID or slug, optionally scoped to a build's
     * output target.
     *
     * Output-target scoping is critical: the website "Default" template and the
     * WordPress "Default (WordPress)" template are distinct rows. Without scoping,
     * a WordPress build's useTemplate("default") resolves to the React template
     * (slug "default") and installs an entire React scaffold into the theme
     * workspace. When a target is supplied and the requested id matches nothing
     * in it, we fall back to that target's system default rather than leaking the
     * other target's template.
     */
    protected function resolveTemplate(string $id, ?string $outputTarget = null): Template
    {
        if (! in_array($outputTarget, ['website', 'wordpress_theme', 'shopify_theme'], true)) {
            $outputTarget = null;
        }

        // An explicit numeric id is unambiguous — trust it regardless of target.
        if (ctype_digit($id)) {
            return Template::findOrFail($id);
        }

        // Resolve by slug first, then fall back to a case-insensitive name match.
        // The builder/AI sometimes passes the display name (e.g. "Default") rather
        // than the slug ("default"); without this fallback useTemplate() 404s and
        // the build proceeds against an empty workspace. slug is unique; name is
        // not, so order deterministically (slug match wins, then lowest id).
        $match = Template::query()
            ->when($outputTarget !== null, fn ($q) => $q->where('output_target', $outputTarget))
            ->where(fn ($q) => $q
                ->where('slug', $id)
                ->orWhereRaw('LOWER(name) = ?', [mb_strtolower($id)]))
            ->orderByRaw('CASE WHEN slug = ? THEN 0 ELSE 1 END', [$id])
            ->orderBy('id')
            ->first();

        if ($match !== null) {
            return $match;
        }

        // The id matched nothing in the requested target (e.g. a WordPress build
        // asked for "default", which only exists as a website template). Use the
        // target's system default so the build runs against the correct scaffold.
        if ($outputTarget !== null) {
            $systemDefault = Template::where('output_target', $outputTarget)
                ->where('is_system', true)
                ->orderBy('id')
                ->first();
            if ($systemDefault !== null) {
                return $systemDefault;
            }
        }

        // Legacy callers (no target) or a target with no system default: preserve
        // the original global slug/name resolution.
        return Template::where('slug', $id)
            ->orWhereRaw('LOWER(name) = ?', [mb_strtolower($id)])
            ->orderByRaw('CASE WHEN slug = ? THEN 0 ELSE 1 END', [$id])
            ->orderBy('id')
            ->firstOrFail();
    }

    /**
     * Get default metadata structure for templates without stored metadata.
     */
    protected function getDefaultMetadata(Template $template): array
    {
        // A WordPress theme is not a React app — never hand the builder React/shadcn
        // guidance (routes.tsx, src/pages, react-router) for an FSE block theme.
        // The seeded wordpress-default ships a real metadata blob; this is the
        // fallback for theme templates uploaded without one.
        if (($template->output_target ?? 'website') === 'wordpress_theme') {
            return [
                'id' => (string) $template->id,
                'name' => $template->name,
                'description' => $template->description ?? '',
                'categories' => ['wordpress'],
                'file_structure' => [
                    'theme_dir' => '.',
                    'templates_dir' => 'templates',
                    'parts_dir' => 'parts',
                    'patterns_dir' => 'patterns',
                    'style_file' => 'style.css',
                    'theme_json' => 'theme.json',
                ],
                'available_pages' => [],
                'custom_components' => [],
                'routing_pattern' => 'wordpress-fse',
                'dependencies' => [],
            ];
        }

        return [
            'id' => (string) $template->id,
            'name' => $template->name,
            'description' => $template->description ?? '',
            'categories' => ['generic'],
            'file_structure' => [
                'pages_dir' => 'src/pages',
                'components_dir' => 'src/components',
                'routes_file' => 'src/routes.tsx',
            ],
            'available_pages' => [],
            'custom_components' => [],
            'shadcn_components' => [
                'Button', 'Card', 'Input', 'Label', 'Textarea',
                'Dialog', 'Tabs', 'Accordion', 'Alert', 'Avatar',
                'Badge', 'Checkbox', 'Select', 'Separator',
                'Switch', 'Table', 'Tooltip', 'Progress',
            ],
            'styling' => [
                'primary_color' => '#3b82f6',
                'framework' => 'tailwind',
                'icon_set' => 'lucide-react',
            ],
            'routing_pattern' => 'react-router',
            'dependencies' => [
                ['name' => 'react-router-dom', 'version' => '^6.26.2'],
            ],
            'usage_examples' => [
                'adding_page' => 'Create new file in src/pages/, then import and add route in src/routes.tsx',
                'adding_route' => 'Add route to routes array in src/routes.tsx: { path: \'/page\', element: <Page /> }',
            ],
        ];
    }
}
