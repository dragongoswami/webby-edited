<?php

namespace Database\Seeders;

use App\Models\DesignSystem;
use Illuminate\Database\Seeder;

class DesignSystemSeeder extends Seeder
{
    public function run(): void
    {
        DesignSystem::updateOrCreate(
            ['slug' => 'substrate'],
            [
                'name' => 'Substrate',
                'description' => 'A warm-neutral, premium house style — Geist + Newsreader, tactile elevation, a 10px radius. The high-end default for almost anything.',
                'when_to_use' => 'The default for most projects: SaaS, marketing, dashboards, stores, blogs. Clean, modern, restrained.',
                'zip_path' => 'design-systems/substrate.zip',
                'version' => '1.0.3',
                'author' => 'Titan Systems',
                'is_default' => true,
                'status' => 'active',
            ]
        );

        // Premium design-system pack (10 systems) — a paid add-on, like the premium
        // templates pack. Seeded for local development and the demo showcase; a
        // normal (non-local) install ships only Substrate until the admin uploads
        // the pack (Admin → Design Systems).
        if (app()->environment('local') || config('app.demo')) {
            $this->seedPremiumPack();
        }

        // Run AFTER all seeding so it acts as a post-seeding invariant: Substrate is
        // the only default — demote any other system that is (or was) marked default.
        DesignSystem::where('slug', '!=', 'substrate')->where('is_default', true)->update(['is_default' => false]);
    }

    /**
     * Seed the premium design-system pack. Each system is a complete installable
     * identity (tokens + accents + fonts + agent playbook) the Go builder overlays at
     * build time; the runtime zip lives at storage/app/private/design-systems/<slug>.zip.
     */
    private function seedPremiumPack(): void
    {
        $systems = [
            [
                'slug' => 'aperture',
                'name' => 'Aperture',
                'description' => 'A crisp, cool-toned, architectural SaaS aesthetic — Manrope + Space Grotesk, a precise 10px radius, lots of whitespace. Linear/Vercel-grade but cooler and more exact.',
                'when_to_use' => 'Modern software products: SaaS dashboards, developer tools, B2B apps, analytics, technical marketing. Choose when the brief wants precise, cool, confident and architectural (not warm or playful).',
                'zip_path' => 'design-systems/aperture.zip',
            ],
            [
                'slug' => 'botanica',
                'name' => 'Botanica',
                'description' => 'A warm, organic, editorial wellness aesthetic — Fraunces serif + Mulish, cream paper, forest greens and clay, a soft 16px radius and warm shadows. Calm, natural and premium (spa / apothecary / sustainable brand).',
                'when_to_use' => 'Wellness, beauty, food & beverage, sustainability, lifestyle, hospitality, editorial and artisan brands. Choose when the brief is warm, natural, calm and premium — not cool or techy.',
                'zip_path' => 'design-systems/botanica.zip',
            ],
            [
                'slug' => 'monolith',
                'name' => 'Monolith',
                'description' => 'A bold, brutalist Swiss-editorial aesthetic — Archivo Black + Space Grotesk, paper-and-ink contrast, 0px sharp corners, heavy borders, hard offset-block shadows and one punchy accent. Confident and graphic.',
                'when_to_use' => 'Fashion, art/galleries, music, streetwear, editorial, agencies, bold statement landing pages and portfolios. Choose when the brief wants loud, graphic, high-contrast and unmistakable — never soft or corporate.',
                'zip_path' => 'design-systems/monolith.zip',
            ],
            [
                'slug' => 'noir',
                'name' => 'Noir',
                'description' => 'A dark-luxe, cinematic, premium aesthetic — Cormorant Garamond display over Inter, deep warm-charcoal surfaces with a single restrained metallic accent (champagne gold), hairline borders, soft diffuse shadows. Dark-first, with a matching ivory-paper light mode. Expensive and restrained.',
                'when_to_use' => 'Luxury & high-end brands — watches, jewelry, spirits, fashion, premium real estate, boutique hospitality, members-only clubs, fine dining, private wealth. Choose when the brief wants refined, nocturnal, expensive and understated — never bright, playful or corporate.',
                'zip_path' => 'design-systems/noir.zip',
            ],
            [
                'slug' => 'bloom',
                'name' => 'Bloom',
                'description' => 'A playful, friendly, joyful aesthetic — chunky rounded Baloo 2 headlines over warm Nunito body, soft cream surfaces with a cozy deep-plum dark mode, large 20px radius, pill buttons, pillowy warm shadows and six sweet candy accents. Cheerful and optimistic, premium not childish.',
                'when_to_use' => 'Consumer, community and feel-good products — kids & education, creative tools, wellness, events, social, food & fun, family apps, anything that wants to feel warm, optimistic and approachable. Choose when the brief is cheerful and human — never corporate, luxe or brutalist.',
                'zip_path' => 'design-systems/bloom.zip',
            ],
            [
                'slug' => 'atrium',
                'name' => 'Atrium',
                'description' => 'A trustworthy, professional enterprise-SaaS aesthetic — IBM Plex Sans + IBM Plex Mono, crisp cool-neutral surfaces, a confident corporate-blue accent, 6px radius, clean hairline borders and subtle shadows. Dashboard-grade clarity with a calm boardroom dark mode. Credible and structured.',
                'when_to_use' => 'B2B & enterprise software — SaaS platforms, fintech & banking dashboards, healthcare, insurance, analytics, admin panels, corporate productivity and data tools. Choose when the brief must read credible, calm and structured — the look that earns trust with money and data. Never playful, luxe or brutalist.',
                'zip_path' => 'design-systems/atrium.zip',
            ],
            [
                'slug' => 'sandstone',
                'name' => 'Sandstone',
                'description' => 'A warm, minimal, editorial aesthetic — Newsreader serif over Hanken Grotesk, oat-and-bone paper surfaces with a cozy espresso dark mode, a muted earthy clay accent, small 6px radius, hairline warm borders and near-flat shadows. Minimalism with soul — calm, literary, quietly confident.',
                'when_to_use' => 'Editorial, craft and slow-brand work — publishing & content, writing tools, thoughtful indie SaaS, portfolios, architecture & interior studios, hospitality, wellness, artisanal and slow-living brands. Choose when the brief wants warm, literary, restrained minimalism with soul — never cold-corporate, luxe-dark or loud.',
                'zip_path' => 'design-systems/sandstone.zip',
            ],
            [
                'slug' => 'halcyon',
                'name' => 'Halcyon',
                'description' => 'A serene, airy, dreamy-pastel aesthetic — soft Plus Jakarta Sans over JetBrains Mono, morning-haze cool-white surfaces with a deep-twilight dark mode, a gentle periwinkle accent, generous 14px radius and soft accent-tinted glow shadows. Weightless, tranquil and breathable — calm tech that feels like a clear sky.',
                'when_to_use' => 'Calm, human, wellbeing-oriented products — meditation, sleep & mindfulness, journaling, calm productivity & focus tools, soft consumer wellness, gentle fintech & healthcare-lite, AI companions and assistants. Choose when the brief wants serene, soft, weightless and optimistic — never loud, corporate, brutalist or dark-techy.',
                'zip_path' => 'design-systems/halcyon.zip',
            ],
            [
                'slug' => 'carbon',
                'name' => 'Carbon',
                'description' => 'A sleek, technical, developer-tool aesthetic — Space Grotesk + JetBrains Mono, near-black cool-graphite surfaces with a crisp IDE light mode, a high-energy terminal-green accent that pops like a cursor, 6px radius, hairline borders and accent-glow focus. Dark-first, precise, engineered — the look devs trust.',
                'when_to_use' => 'Developer and technical products — dev platforms & APIs, terminals/CLIs, AI/ML infra, observability & analytics, crypto/web3 dashboards, hacker-grade SaaS and data tooling. Choose when the brief is precise, dark, futuristic and engineered, with heavy monospace and code. Never soft, luxe, corporate or playful.',
                'zip_path' => 'design-systems/carbon.zip',
            ],
            [
                'slug' => 'lumen',
                'name' => 'Lumen',
                'description' => 'A vibrant, premium modern-fintech glow aesthetic — confident Sora display over JetBrains Mono, deep midnight-violet surfaces with a clean bright light mode, a luminous electric-violet accent built for gradients and glow, glassmorphism, 12px radius and colored accent-glow shadows. Bold, luminous and high-end — the look of a hot modern startup, done tastefully.',
                'when_to_use' => 'Bold, modern, premium-tech products — next-gen fintech & neobanks, crypto & payments, AI products, modern SaaS launch/marketing pages, futuristic consumer tech. Choose when the brief wants energetic, luminous, gradient-glow and premium with glassmorphism. Never muted-minimal, terminal-dev, corporate or soft-pastel.',
                'zip_path' => 'design-systems/lumen.zip',
            ],
        ];

        foreach ($systems as $data) {
            DesignSystem::updateOrCreate(
                ['slug' => $data['slug']],
                $data + [
                    'version' => '1.0.3',
                    'author' => 'Titan Systems',
                    'is_default' => false,
                    'status' => 'active',
                ]
            );
        }
    }
}
