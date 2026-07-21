<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Template;
use Illuminate\Database\Seeder;

class TemplateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Default website template - is_system=true means it cannot be deleted
        Template::updateOrCreate(
            ['slug' => 'default'],
            [
                'name' => 'Default',
                'description' => 'Default React/TypeScript template with Vite, Tailwind CSS, and shadcn/ui components.',
                'category' => 'system',
                'keywords' => ['general', 'website', 'web app'],
                'zip_path' => 'templates/default-template.zip',
                'version' => '1.0.0',
                'is_system' => true,
                'output_target' => 'website',
                'metadata' => [
                    'framework' => 'React 18.3.1',
                    'language' => 'TypeScript',
                    'build_tool' => 'Vite 6.0.1',
                    'styling' => 'Tailwind CSS 4.0',
                    'components' => 'shadcn/ui',
                ],
            ]
        );

        // Default WordPress block theme - the FSE starting point for AI-generated
        // WordPress themes. Seeded on every install (is_system, un-deletable), but
        // only ever shown in WordPress mode (which requires the WordPress plugin).
        Template::updateOrCreate(
            ['slug' => 'wordpress-default'],
            [
                'name' => 'Default (WordPress)',
                'description' => 'The default WordPress Full Site Editing (FSE) block theme — theme.json, block templates, header/footer parts, block patterns, and functions.php. The starting point for AI-generated WordPress themes.',
                'category' => 'wordpress',
                'keywords' => ['wordpress', 'block theme', 'fse', 'gutenberg', 'default'],
                'zip_path' => 'templates/wordpress-default.zip',
                'version' => '1.0.0',
                'is_system' => true,
                'output_target' => 'wordpress_theme',
                'metadata' => [
                    'framework' => 'WordPress FSE',
                    'format' => 'block theme',
                ],
            ]
        );

        // Default Shopify theme — the Online Store 2.0 starting point for
        // AI-generated Shopify themes (Shopify's official Skeleton reference theme,
        // MIT). Seeded on every install (is_system, un-deletable), only shown in
        // Shopify mode (which requires the Shopify plugin).
        Template::updateOrCreate(
            ['slug' => 'shopify-skeleton'],
            [
                'name' => 'Shopify Skeleton',
                'description' => "Shopify Online Store 2.0 starter theme based on Shopify's official Skeleton reference theme — layout/theme.liquid, JSON templates, sections, blocks, snippets, settings_schema.json. The starting point for AI-generated Shopify themes.",
                'category' => 'shopify',
                'keywords' => ['shopify', 'theme', 'online store 2.0', 'liquid', 'skeleton', 'default'],
                'zip_path' => 'templates/shopify-default.zip',
                'version' => '1.0.0',
                'is_system' => true,
                'output_target' => 'shopify_theme',
                'metadata' => [
                    'framework' => 'Shopify OS 2.0',
                    'format' => 'liquid theme',
                ],
            ]
        );

        // Premium templates are seeded for local development and the demo showcase.
        // On a normal (non-local) install they are a paid add-on the admin uploads
        // (Admin → AI Templates), so they are NOT seeded there.
        if (app()->environment('local') || config('app.demo')) {
            $this->seedAdditionalTemplates();
        }
    }

    /**
     * Seed the premium templates for the demo showcase, and attach them to the
     * plans that include custom templates so they are actually selectable.
     */
    private function seedAdditionalTemplates(): void
    {
        $templates = [
            [
                'slug' => 'ecommerce',
                'name' => 'E-commerce Store',
                'description' => 'Complete e-commerce template with products, cart, checkout, and user accounts',
                'category' => 'ecommerce',
                'keywords' => ['shop', 'store', 'product', 'cart', 'checkout', 'buy', 'sell', 'payment'],
                'zip_path' => 'templates/ecommerce-template.zip',
                'is_system' => false,
                'output_target' => 'website',
            ],
            [
                'slug' => 'dashboard',
                'name' => 'Admin Dashboard',
                'description' => 'Admin dashboard template with analytics, metrics, and management features',
                'category' => 'dashboard',
                'keywords' => ['dashboard', 'admin', 'analytics', 'metrics', 'stats', 'reports'],
                'zip_path' => 'templates/dashboard-template.zip',
                'is_system' => false,
                'output_target' => 'website',
            ],
            [
                'slug' => 'cms',
                'name' => 'Blog/CMS',
                'description' => 'Content management template for blogs, articles, and publishing',
                'category' => 'cms',
                'keywords' => ['blog', 'posts', 'articles', 'content', 'publish', 'news'],
                'zip_path' => 'templates/cms-template.zip',
                'is_system' => false,
                'output_target' => 'website',
            ],
            [
                'slug' => 'landing',
                'name' => 'Landing Page',
                'description' => 'Marketing landing page template with hero, features, pricing, and CTA sections',
                'category' => 'landing',
                'keywords' => ['landing', 'marketing', 'startup', 'saas', 'agency', 'promotional'],
                'zip_path' => 'templates/landing-template.zip',
                'is_system' => false,
                'output_target' => 'website',
            ],
            [
                'slug' => 'portfolio',
                'name' => 'Portfolio',
                'description' => 'Portfolio template for showcasing projects, work, and personal sites',
                'category' => 'portfolio',
                'keywords' => ['portfolio', 'showcase', 'gallery', 'projects', 'resume', 'personal'],
                'zip_path' => 'templates/portfolio-template.zip',
                'is_system' => false,
                'output_target' => 'website',
            ],
        ];

        foreach ($templates as $data) {
            Template::updateOrCreate(
                ['slug' => $data['slug']],
                $data
            );
        }

        // Make the seeded categorized templates usable: attach them to the plans
        // that include custom templates (Pro, Enterprise). Without this the
        // plan_template pivot stays empty and only the system "Default" template
        // is selectable, so pinning any categorized template is rejected.
        $templateIds = Template::whereIn('slug', array_column($templates, 'slug'))->pluck('id');
        Plan::whereIn('slug', ['pro', 'enterprise'])->get()->each(
            fn (Plan $plan) => $plan->templates()->syncWithoutDetaching($templateIds)
        );
    }
}
