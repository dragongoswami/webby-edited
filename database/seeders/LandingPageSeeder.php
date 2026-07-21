<?php

namespace Database\Seeders;

use App\Models\LandingContent;
use App\Models\LandingItem;
use App\Models\LandingSection;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class LandingPageSeeder extends Seeder
{
    /**
     * Supported locales for seeding.
     */
    protected array $locales = ['en', 'ar', 'de', 'es', 'fr', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'vi', 'zh'];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Idempotent + additive: safe to run on an existing install to backfill
        // missing sections/content/items (e.g. new feature cards or new locales)
        // without duplicating rows or overwriting operator customizations.
        // Create all sections in order
        $sections = [
            ['type' => 'hero', 'sort_order' => 0, 'is_enabled' => true],
            ['type' => 'social_proof', 'sort_order' => 1, 'is_enabled' => true],
            ['type' => 'features', 'sort_order' => 2, 'is_enabled' => true, 'settings' => ['layout' => 'bento', 'show_icons' => true]],
            ['type' => 'product_showcase', 'sort_order' => 3, 'is_enabled' => true],
            ['type' => 'use_cases', 'sort_order' => 4, 'is_enabled' => true],
            ['type' => 'pricing', 'sort_order' => 5, 'is_enabled' => true],
            ['type' => 'categories', 'sort_order' => 6, 'is_enabled' => true],
            ['type' => 'trusted_by', 'sort_order' => 7, 'is_enabled' => false],
            ['type' => 'testimonials', 'sort_order' => 8, 'is_enabled' => false],
            ['type' => 'faq', 'sort_order' => 9, 'is_enabled' => false],
            ['type' => 'cta', 'sort_order' => 10, 'is_enabled' => true],
        ];

        foreach ($sections as $sectionData) {
            // firstOrCreate by type preserves an operator's enabled/disabled + settings choices.
            LandingSection::firstOrCreate(
                ['type' => $sectionData['type']],
                $sectionData
            );
        }

        // Seed content for each section (Hero is AI-powered, no database content needed)
        $this->seedSocialProofSection();
        $this->seedFeaturesSection();
        $this->seedProductShowcaseSection();
        $this->seedUseCasesSection();
        $this->seedPricingSection();
        $this->seedCategoriesSection();
        $this->seedTrustedBySection();
        $this->seedTestimonialsSection();
        $this->seedFaqSection();
        $this->seedCtaSection();
    }

    protected function seedSocialProofSection(): void
    {
        $section = LandingSection::where('type', 'social_proof')->first();

        $translations = [
            'en' => [
                'users_label' => 'Happy users',
                'projects_label' => 'Projects created',
                'uptime_label' => 'Availability',
                'uptime_value' => 'High',
            ],
            'ar' => [
                'users_label' => 'مستخدمون سعداء',
                'projects_label' => 'مشاريع تم إنشاؤها',
                'uptime_label' => 'التوفر',
                'uptime_value' => 'عالي',
            ],
            'de' => [
                'users_label' => 'Zufriedene Nutzer',
                'projects_label' => 'Erstellte Projekte',
                'uptime_label' => 'Verfügbarkeit',
                'uptime_value' => 'Hoch',
            ],
            'fr' => [
                'users_label' => 'Utilisateurs satisfaits',
                'projects_label' => 'Projets créés',
                'uptime_label' => 'Disponibilité',
                'uptime_value' => 'Élevée',
            ],
            'ja' => [
                'users_label' => '満足したユーザー',
                'projects_label' => '作成されたプロジェクト',
                'uptime_label' => '可用性',
                'uptime_value' => '高い',
            ],
            'ru' => [
                'users_label' => 'Довольных пользователей',
                'projects_label' => 'Созданных проектов',
                'uptime_label' => 'Доступность',
                'uptime_value' => 'Высокая',
            ],
            'it' => [
                'users_label' => 'Utenti soddisfatti',
                'projects_label' => 'Progetti creati',
                'uptime_label' => 'Disponibilità',
                'uptime_value' => 'Alta',
            ],
            'zh' => [
                'users_label' => '满意用户',
                'projects_label' => '已创建项目',
                'uptime_label' => '可用性',
                'uptime_value' => '高',
            ],
            'id' => [
                'users_label' => 'Pengguna puas',
                'projects_label' => 'Proyek dibuat',
                'uptime_label' => 'Ketersediaan',
                'uptime_value' => 'Tinggi',
            ],
            'pt' => [
                'users_label' => 'Usuários satisfeitos',
                'projects_label' => 'Projetos criados',
                'uptime_label' => 'Disponibilidade',
                'uptime_value' => 'Alta',
            ],
            'es' => [
                'users_label' => 'Usuarios satisfechos',
                'projects_label' => 'Proyectos creados',
                'uptime_label' => 'Disponibilidad',
                'uptime_value' => 'Alta',
            ],
            'ko' => [
                'users_label' => '만족한 사용자',
                'projects_label' => '생성된 프로젝트',
                'uptime_label' => '가용성',
                'uptime_value' => '높음',
            ],
            'vi' => [
                'users_label' => 'Người dùng hài lòng',
                'projects_label' => 'Dự án đã tạo',
                'uptime_label' => 'Khả dụng',
                'uptime_value' => 'Cao',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }
    }

    protected function seedFeaturesSection(): void
    {
        $section = LandingSection::where('type', 'features')->first();

        $translations = [
            'en' => [
                'title' => 'Everything you need to build',
                'subtitle' => 'From idea to deployment, we\'ve got you covered with powerful features designed for modern development.',
            ],
            'ar' => [
                'title' => 'كل ما تحتاجه للبناء',
                'subtitle' => 'من الفكرة إلى النشر، نوفر لك ميزات قوية مصممة للتطوير الحديث.',
            ],
            'de' => [
                'title' => 'Alles was Sie zum Bauen brauchen',
                'subtitle' => 'Von der Idee bis zur Bereitstellung - wir bieten Ihnen leistungsstarke Funktionen für moderne Entwicklung.',
            ],
            'fr' => [
                'title' => 'Tout ce dont vous avez besoin',
                'subtitle' => 'De l\'idée au déploiement, nous vous offrons des fonctionnalités puissantes pour le développement moderne.',
            ],
            'ja' => [
                'title' => '構築に必要なすべて',
                'subtitle' => 'アイデアからデプロイまで、モダンな開発のための強力な機能を提供します。',
            ],
            'ru' => [
                'title' => 'Всё необходимое для разработки',
                'subtitle' => 'От идеи до развёртывания — мощные инструменты для современной разработки.',
            ],
            'it' => [
                'title' => 'Tutto ciò che ti serve per costruire',
                'subtitle' => 'Dall\'idea al deployment, ti offriamo funzionalità potenti progettate per lo sviluppo moderno.',
            ],
            'zh' => [
                'title' => '构建所需的一切',
                'subtitle' => '从创意到部署，我们为您提供专为现代开发设计的强大功能。',
            ],
            'id' => [
                'title' => 'Semua yang Anda butuhkan untuk membangun',
                'subtitle' => 'Dari ide hingga deployment, kami menyediakan fitur canggih yang dirancang untuk pengembangan modern.',
            ],
            'pt' => [
                'title' => 'Tudo que você precisa para construir',
                'subtitle' => 'Da ideia à implantação, oferecemos recursos poderosos projetados para o desenvolvimento moderno.',
            ],
            'es' => [
                'title' => 'Todo lo que necesitas para construir',
                'subtitle' => 'De la idea al despliegue, te ofrecemos funciones potentes diseñadas para el desarrollo moderno.',
            ],
            'ko' => [
                'title' => '빌드에 필요한 모든 것',
                'subtitle' => '아이디어에서 배포까지, 현대 개발을 위한 강력한 기능을 제공합니다.',
            ],
            'vi' => [
                'title' => 'Mọi thứ bạn cần để xây dựng',
                'subtitle' => 'Từ ý tưởng đến triển khai, chúng tôi cung cấp các tính năng mạnh mẽ được thiết kế cho phát triển hiện đại.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }

        // Create feature items for each locale
        $featureTranslations = [
            'en' => [
                ['title' => 'AI-Powered Development', 'description' => 'Describe what you want, and watch it come to life. Our AI understands context and builds complete applications.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Real-time Preview', 'description' => 'See your changes instantly as the AI builds your project. No waiting, no refreshing.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Built-in Code Editor', 'description' => 'Full Monaco editor with syntax highlighting, file tree, and code completion.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Export & Deploy', 'description' => 'Host on our platform or export your code to deploy anywhere.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Smart Templates', 'description' => 'Start with AI-selected templates that match your project needs perfectly.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Iterative Refinement', 'description' => 'Keep chatting to refine and improve your creation until it\'s perfect.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Custom Subdomains', 'description' => 'Publish your project to a custom subdomain and share it with the world.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'WordPress Themes', 'description' => 'Generate installable WordPress block themes (FSE) from a prompt — no manual setup.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Shopify Themes', 'description' => 'Build Online Store 2.0 themes and push them straight to your Shopify store.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'GitHub Sync', 'description' => 'Auto-push your generated source to a private GitHub repo after every build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Connect Your Database', 'description' => 'Bring your own Supabase project and let the AI generate auth and tables for your app.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Design Systems', 'description' => 'Swap a complete visual identity — colors, fonts, and tokens — without touching your layout.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'Personal API', 'description' => 'Access your account, projects, and usage programmatically with read-only API keys.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Voice Input', 'description' => 'Describe your project hands-free with built-in, browser-native voice prompting.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'ar' => [
                ['title' => 'تطوير بالذكاء الاصطناعي', 'description' => 'صف ما تريده وشاهده يتحقق. الذكاء الاصطناعي يفهم السياق ويبني تطبيقات كاملة.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'معاينة فورية', 'description' => 'شاهد التغييرات فوراً أثناء بناء الذكاء الاصطناعي لمشروعك.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'محرر أكواد مدمج', 'description' => 'محرر Monaco كامل مع تمييز الصياغة وشجرة الملفات.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'تصدير ونشر', 'description' => 'استضف على منصتنا أو صدّر الكود للنشر في أي مكان.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'قوالب ذكية', 'description' => 'ابدأ بقوالب يختارها الذكاء الاصطناعي تناسب احتياجات مشروعك.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'تحسين تكراري', 'description' => 'استمر بالمحادثة لتحسين إبداعك حتى يصبح مثالياً.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'نطاقات فرعية مخصصة', 'description' => 'انشر مشروعك على نطاق فرعي مخصص وشاركه مع العالم.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'قوالب WordPress', 'description' => 'أنشئ قوالب WordPress بلوك (FSE) قابلة للتثبيت من وصف نصي — دون إعداد يدوي.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'قوالب Shopify', 'description' => 'ابنِ قوالب Online Store 2.0 وارفعها مباشرة إلى متجر Shopify الخاص بك.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'مزامنة GitHub', 'description' => 'ارفع الكود المُنشأ تلقائياً إلى مستودع GitHub خاص بعد كل عملية بناء.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'ربط قاعدة البيانات', 'description' => 'استخدم مشروع Supabase الخاص بك ودع الذكاء الاصطناعي يُنشئ المصادقة والجداول.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'أنظمة التصميم', 'description' => 'غيّر هوية بصرية كاملة — ألوان وخطوط ورموز — دون المساس بالتخطيط.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API الشخصية', 'description' => 'الوصول إلى حسابك ومشاريعك واستخدامك برمجياً بمفاتيح API للقراءة فقط.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'الإدخال الصوتي', 'description' => 'صف مشروعك بدون لمس لوحة المفاتيح باستخدام الإدخال الصوتي المدمج في المتصفح.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'de' => [
                ['title' => 'KI-gestützte Entwicklung', 'description' => 'Beschreiben Sie, was Sie wollen, und sehen Sie zu, wie es entsteht. Unsere KI versteht den Kontext.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Echtzeit-Vorschau', 'description' => 'Sehen Sie Ihre Änderungen sofort, während die KI Ihr Projekt erstellt.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Integrierter Code-Editor', 'description' => 'Vollständiger Monaco-Editor mit Syntaxhervorhebung und Dateibaum.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Exportieren & Bereitstellen', 'description' => 'Hosten Sie auf unserer Plattform oder exportieren Sie Ihren Code.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Intelligente Vorlagen', 'description' => 'Starten Sie mit KI-ausgewählten Vorlagen, die perfekt zu Ihrem Projekt passen.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Iterative Verfeinerung', 'description' => 'Chatten Sie weiter, um Ihre Kreation zu verfeinern und zu verbessern.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Eigene Subdomains', 'description' => 'Veröffentlichen Sie Ihr Projekt auf einer eigenen Subdomain.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'WordPress-Themes', 'description' => 'Erstellen Sie installierbare WordPress-Block-Themes (FSE) aus einem Prompt — ohne manuelles Setup.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Shopify-Themes', 'description' => 'Erstellen Sie Online Store 2.0-Themes und übertragen Sie sie direkt in Ihren Shopify-Store.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'GitHub-Synchronisierung', 'description' => 'Übertragen Sie Ihren generierten Quellcode nach jedem Build automatisch in ein privates GitHub-Repository.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Datenbank verbinden', 'description' => 'Bringen Sie Ihr eigenes Supabase-Projekt mit und lassen Sie die KI Authentifizierung und Tabellen erstellen.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Design-Systeme', 'description' => 'Tauschen Sie eine vollständige visuelle Identität — Farben, Schriften und Tokens — ohne Ihr Layout zu ändern.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'Persönliche API', 'description' => 'Greifen Sie programmgesteuert auf Ihr Konto, Projekte und Nutzung mit schreibgeschützten API-Schlüsseln zu.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Spracheingabe', 'description' => 'Beschreiben Sie Ihr Projekt freihändig mit integrierter, browsereigener Spracheingabe.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'fr' => [
                ['title' => 'Développement par IA', 'description' => 'Décrivez ce que vous voulez et regardez-le prendre vie. Notre IA comprend le contexte.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Aperçu en temps réel', 'description' => 'Voyez vos modifications instantanément pendant que l\'IA construit votre projet.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Éditeur de code intégré', 'description' => 'Éditeur Monaco complet avec coloration syntaxique et arborescence.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Exporter & Déployer', 'description' => 'Hébergez sur notre plateforme ou exportez votre code pour le déployer ailleurs.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Modèles intelligents', 'description' => 'Commencez avec des modèles sélectionnés par l\'IA adaptés à votre projet.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Raffinement itératif', 'description' => 'Continuez à discuter pour affiner et améliorer votre création.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Sous-domaines personnalisés', 'description' => 'Publiez votre projet sur un sous-domaine personnalisé.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Thèmes WordPress', 'description' => 'Générez des thèmes WordPress block (FSE) installables depuis un prompt — sans configuration manuelle.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Thèmes Shopify', 'description' => 'Créez des thèmes Online Store 2.0 et poussez-les directement sur votre boutique Shopify.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Synchronisation GitHub', 'description' => 'Poussez automatiquement votre source générée vers un dépôt GitHub privé après chaque build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Connectez votre base de données', 'description' => 'Apportez votre propre projet Supabase et laissez l\'IA générer l\'authentification et les tables.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Systèmes de design', 'description' => 'Changez une identité visuelle complète — couleurs, polices et tokens — sans toucher à votre mise en page.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API personnelle', 'description' => 'Accédez à votre compte, vos projets et votre utilisation par programmation avec des clés API en lecture seule.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Saisie vocale', 'description' => 'Décrivez votre projet en mode mains libres grâce à la saisie vocale native du navigateur.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'ja' => [
                ['title' => 'AI駆動開発', 'description' => '欲しいものを説明するだけで実現します。AIがコンテキストを理解し、完全なアプリを構築します。', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'リアルタイムプレビュー', 'description' => 'AIがプロジェクトを構築する間、変更を即座に確認できます。', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => '内蔵コードエディタ', 'description' => 'シンタックスハイライトとファイルツリーを備えたMonacoエディタ。', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'エクスポート＆デプロイ', 'description' => '当社プラットフォームでホストするか、コードをエクスポートして任意の場所にデプロイ。', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'スマートテンプレート', 'description' => 'プロジェクトに最適なAI選択テンプレートから始めましょう。', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => '反復的改善', 'description' => '完璧になるまでチャットを続けて創作物を改善しましょう。', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'カスタムサブドメイン', 'description' => 'カスタムサブドメインでプロジェクトを公開し、世界と共有。', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'WordPressテーマ', 'description' => 'プロンプトからインストール可能なWordPressブロックテーマ（FSE）を生成 — 手動設定不要。', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Shopifyテーマ', 'description' => 'Online Store 2.0テーマを構築し、Shopifyストアに直接プッシュ。', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'GitHub同期', 'description' => 'ビルドのたびに生成したソースをプライベートGitHubリポジトリへ自動プッシュ。', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'データベース接続', 'description' => '自分のSupabaseプロジェクトを持ち込み、AIに認証とテーブルを生成させましょう。', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'デザインシステム', 'description' => 'レイアウトを変えずに、色・フォント・トークンをまるごと入れ替え。', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'パーソナルAPI', 'description' => '読み取り専用APIキーでアカウント・プロジェクト・利用状況にプログラムでアクセス。', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => '音声入力', 'description' => 'ブラウザネイティブの音声入力でハンズフリーにプロジェクトを説明。', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'ru' => [
                ['title' => 'Разработка с ИИ', 'description' => 'Опишите, что вы хотите, и наблюдайте, как это оживает. Наш ИИ понимает контекст.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Предпросмотр в реальном времени', 'description' => 'Мгновенно видьте изменения, пока ИИ создаёт ваш проект.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Встроенный редактор кода', 'description' => 'Полноценный редактор Monaco с подсветкой синтаксиса и деревом файлов.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Экспорт и развёртывание', 'description' => 'Размещайте на нашей платформе или экспортируйте код для развёртывания в любом месте.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Умные шаблоны', 'description' => 'Начните с шаблонов, выбранных ИИ, которые идеально подходят для вашего проекта.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Итеративное улучшение', 'description' => 'Продолжайте общение, чтобы улучшать своё творение до совершенства.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Собственные поддомены', 'description' => 'Публикуйте проект на собственном поддомене и делитесь им с миром.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Темы WordPress', 'description' => 'Генерируйте устанавливаемые блок-темы WordPress (FSE) из промпта — без ручной настройки.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Темы Shopify', 'description' => 'Создавайте темы Online Store 2.0 и загружайте их прямо в ваш магазин Shopify.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Синхронизация с GitHub', 'description' => 'Автоматически отправляйте сгенерированный код в приватный репозиторий GitHub после каждой сборки.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Подключение базы данных', 'description' => 'Используйте собственный проект Supabase и позвольте ИИ создать аутентификацию и таблицы.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Дизайн-системы', 'description' => 'Меняйте полную визуальную идентичность — цвета, шрифты и токены — не трогая макет.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'Личный API', 'description' => 'Получайте программный доступ к аккаунту, проектам и статистике с помощью API-ключей только для чтения.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Голосовой ввод', 'description' => 'Описывайте проект руками свободно с встроенным голосовым вводом браузера.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'it' => [
                ['title' => 'Sviluppo con IA', 'description' => 'Descrivi ciò che vuoi e guardalo prendere vita. La nostra IA comprende il contesto e costruisce applicazioni complete.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Anteprima in tempo reale', 'description' => 'Visualizza le modifiche istantaneamente mentre l\'IA costruisce il tuo progetto.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Editor di codice integrato', 'description' => 'Editor Monaco completo con evidenziazione della sintassi e albero dei file.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Esporta e distribuisci', 'description' => 'Ospita sulla nostra piattaforma o esporta il codice per distribuirlo ovunque.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Template intelligenti', 'description' => 'Inizia con template selezionati dall\'IA perfetti per le esigenze del tuo progetto.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Raffinamento iterativo', 'description' => 'Continua a chattare per perfezionare e migliorare la tua creazione.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Sottodomini personalizzati', 'description' => 'Pubblica il tuo progetto su un sottodominio personalizzato e condividilo con il mondo.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Temi WordPress', 'description' => 'Genera temi WordPress a blocchi (FSE) installabili da un prompt — senza configurazione manuale.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Temi Shopify', 'description' => 'Crea temi Online Store 2.0 e caricali direttamente nel tuo negozio Shopify.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Sincronizzazione GitHub', 'description' => 'Invia automaticamente il sorgente generato a un repository GitHub privato dopo ogni build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Connetti il tuo database', 'description' => 'Usa il tuo progetto Supabase e lascia che l\'IA generi autenticazione e tabelle.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Sistemi di design', 'description' => 'Sostituisci un\'identità visiva completa — colori, font e token — senza toccare il layout.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API personale', 'description' => 'Accedi al tuo account, progetti e utilizzo in modo programmatico con chiavi API in sola lettura.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Input vocale', 'description' => 'Descrivi il tuo progetto a mani libere con l\'input vocale nativo del browser integrato.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'zh' => [
                ['title' => 'AI驱动开发', 'description' => '描述您想要的，看着它变为现实。我们的AI理解上下文并构建完整的应用程序。', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => '实时预览', 'description' => '在AI构建项目的同时即时查看更改。无需等待，无需刷新。', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => '内置代码编辑器', 'description' => '完整的Monaco编辑器，支持语法高亮、文件树和代码补全。', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => '导出与部署', 'description' => '在我们的平台上托管，或导出代码部署到任何地方。', 'icon' => 'Download', 'size' => 'small'],
                ['title' => '智能模板', 'description' => '使用AI精选的模板开始，完美匹配您的项目需求。', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => '迭代优化', 'description' => '持续对话，不断完善和改进您的作品直到完美。', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => '自定义子域名', 'description' => '将项目发布到自定义子域名，与全世界分享。', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'WordPress主题', 'description' => '从提示词生成可安装的WordPress块主题（FSE）— 无需手动设置。', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Shopify主题', 'description' => '构建Online Store 2.0主题并直接推送到您的Shopify商店。', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'GitHub同步', 'description' => '每次构建后自动将生成的源代码推送到私有GitHub仓库。', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => '连接数据库', 'description' => '带入您自己的Supabase项目，让AI为您的应用生成认证和数据表。', 'icon' => 'Database', 'size' => 'small'],
                ['title' => '设计系统', 'description' => '替换完整的视觉标识 — 颜色、字体和令牌 — 无需触碰布局。', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => '个人API', 'description' => '使用只读API密钥以编程方式访问您的账户、项目和用量。', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => '语音输入', 'description' => '使用内置的浏览器原生语音提示免手动描述您的项目。', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'id' => [
                ['title' => 'Pengembangan Bertenaga AI', 'description' => 'Jelaskan apa yang Anda inginkan, dan saksikan menjadi kenyataan. AI kami memahami konteks dan membangun aplikasi lengkap.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Pratinjau Real-time', 'description' => 'Lihat perubahan Anda secara instan saat AI membangun proyek Anda.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Editor Kode Bawaan', 'description' => 'Editor Monaco lengkap dengan penyorotan sintaks dan pohon file.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Ekspor & Deploy', 'description' => 'Host di platform kami atau ekspor kode untuk di-deploy di mana saja.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Template Cerdas', 'description' => 'Mulai dengan template pilihan AI yang sesuai dengan kebutuhan proyek Anda.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Penyempurnaan Iteratif', 'description' => 'Terus mengobrol untuk menyempurnakan dan meningkatkan kreasi Anda.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Subdomain Kustom', 'description' => 'Publikasikan proyek Anda ke subdomain kustom dan bagikan ke seluruh dunia.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Tema WordPress', 'description' => 'Hasilkan tema WordPress block (FSE) yang dapat diinstal dari prompt — tanpa pengaturan manual.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Tema Shopify', 'description' => 'Buat tema Online Store 2.0 dan dorong langsung ke toko Shopify Anda.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Sinkronisasi GitHub', 'description' => 'Dorong otomatis sumber yang dihasilkan ke repo GitHub privat setelah setiap build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Hubungkan Database Anda', 'description' => 'Bawa proyek Supabase Anda sendiri dan biarkan AI membuat autentikasi dan tabel untuk aplikasi Anda.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Sistem Desain', 'description' => 'Ganti identitas visual lengkap — warna, font, dan token — tanpa mengubah tata letak Anda.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API Pribadi', 'description' => 'Akses akun, proyek, dan penggunaan Anda secara programatik dengan kunci API hanya-baca.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Input Suara', 'description' => 'Jelaskan proyek Anda tanpa tangan dengan prompting suara bawaan browser.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'pt' => [
                ['title' => 'Desenvolvimento com IA', 'description' => 'Descreva o que você quer e veja ganhar vida. Nossa IA entende o contexto e constrói aplicações completas.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Prévia em tempo real', 'description' => 'Veja suas alterações instantaneamente enquanto a IA constrói seu projeto.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Editor de código integrado', 'description' => 'Editor Monaco completo com destaque de sintaxe e árvore de arquivos.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Exportar e implantar', 'description' => 'Hospede em nossa plataforma ou exporte seu código para implantar em qualquer lugar.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Templates inteligentes', 'description' => 'Comece com templates selecionados por IA perfeitos para as necessidades do seu projeto.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Refinamento iterativo', 'description' => 'Continue conversando para refinar e melhorar sua criação até ficar perfeita.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Subdomínios personalizados', 'description' => 'Publique seu projeto em um subdomínio personalizado e compartilhe com o mundo.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Temas WordPress', 'description' => 'Gere temas WordPress block (FSE) instaláveis a partir de um prompt — sem configuração manual.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Temas Shopify', 'description' => 'Crie temas Online Store 2.0 e envie diretamente para sua loja Shopify.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Sincronização GitHub', 'description' => 'Envie automaticamente o código gerado para um repositório GitHub privado após cada build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Conecte seu banco de dados', 'description' => 'Traga seu próprio projeto Supabase e deixe a IA gerar autenticação e tabelas para seu app.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Sistemas de design', 'description' => 'Troque uma identidade visual completa — cores, fontes e tokens — sem tocar no seu layout.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API pessoal', 'description' => 'Acesse sua conta, projetos e uso programaticamente com chaves de API somente leitura.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Entrada de voz', 'description' => 'Descreva seu projeto com as mãos livres usando o prompt de voz nativo do navegador integrado.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'es' => [
                ['title' => 'Desarrollo con IA', 'description' => 'Describe lo que quieres y mira cómo cobra vida. Nuestra IA entiende el contexto y construye aplicaciones completas.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Vista previa en tiempo real', 'description' => 'Ve tus cambios al instante mientras la IA construye tu proyecto. Sin esperas ni recargas.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Editor de código integrado', 'description' => 'Editor Monaco completo con resaltado de sintaxis, árbol de archivos y autocompletado.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Exportar y desplegar', 'description' => 'Aloja en nuestra plataforma o exporta tu código para desplegarlo en cualquier lugar.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Plantillas inteligentes', 'description' => 'Empieza con plantillas seleccionadas por IA que se adaptan perfectamente a tu proyecto.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Refinamiento iterativo', 'description' => 'Sigue conversando para refinar y mejorar tu creación hasta que sea perfecta.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Subdominios personalizados', 'description' => 'Publica tu proyecto en un subdominio personalizado y compártelo con el mundo.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Temas WordPress', 'description' => 'Genera temas de bloques WordPress (FSE) instalables desde un prompt — sin configuración manual.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Temas Shopify', 'description' => 'Crea temas Online Store 2.0 y envíalos directamente a tu tienda Shopify.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Sincronización GitHub', 'description' => 'Envía automáticamente tu código generado a un repositorio privado de GitHub tras cada build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Conecta tu base de datos', 'description' => 'Trae tu propio proyecto Supabase y deja que la IA genere autenticación y tablas para tu app.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Sistemas de diseño', 'description' => 'Cambia una identidad visual completa — colores, fuentes y tokens — sin tocar tu maquetación.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API personal', 'description' => 'Accede a tu cuenta, proyectos y uso programáticamente con claves de API de solo lectura.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Entrada de voz', 'description' => 'Describe tu proyecto sin usar las manos con el prompt de voz nativo del navegador integrado.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'ko' => [
                ['title' => 'AI 기반 개발', 'description' => '원하는 것을 설명하면 실현됩니다. AI가 맥락을 이해하고 완전한 애플리케이션을 구축합니다.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => '실시간 미리보기', 'description' => 'AI가 프로젝트를 구축하는 동안 변경 사항을 즉시 확인하세요. 기다림도 새로고침도 없습니다.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => '내장 코드 편집기', 'description' => '구문 강조, 파일 트리, 코드 자동완성을 갖춘 완전한 Monaco 편집기.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => '내보내기 및 배포', 'description' => '플랫폼에서 호스팅하거나 코드를 내보내 어디서든 배포하세요.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => '스마트 템플릿', 'description' => '프로젝트 요구 사항에 완벽히 맞는 AI 선택 템플릿으로 시작하세요.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => '반복적 개선', 'description' => '완벽해질 때까지 계속 대화하며 결과물을 정제하고 개선하세요.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => '맞춤 서브도메인', 'description' => '맞춤 서브도메인에 프로젝트를 게시하고 세상과 공유하세요.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'WordPress 테마', 'description' => '프롬프트에서 설치 가능한 WordPress 블록 테마(FSE)를 생성 — 수동 설정 불필요.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Shopify 테마', 'description' => 'Online Store 2.0 테마를 구축하고 Shopify 스토어에 바로 푸시하세요.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'GitHub 동기화', 'description' => '매 빌드 후 생성된 소스를 비공개 GitHub 저장소에 자동 푸시합니다.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => '데이터베이스 연결', 'description' => '자신의 Supabase 프로젝트를 가져와 AI가 앱의 인증과 테이블을 생성하도록 하세요.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => '디자인 시스템', 'description' => '레이아웃을 건드리지 않고 색상, 폰트, 토큰 등 완전한 시각적 정체성을 교체하세요.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => '개인 API', 'description' => '읽기 전용 API 키로 계정, 프로젝트, 사용량에 프로그래밍 방식으로 액세스하세요.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => '음성 입력', 'description' => '내장된 브라우저 네이티브 음성 프롬프트로 손을 사용하지 않고 프로젝트를 설명하세요.', 'icon' => 'Mic', 'size' => 'small'],
            ],
            'vi' => [
                ['title' => 'Phát triển bằng AI', 'description' => 'Mô tả điều bạn muốn và xem nó thành hiện thực. AI của chúng tôi hiểu ngữ cảnh và xây dựng ứng dụng hoàn chỉnh.', 'icon' => 'Sparkles', 'size' => 'large'],
                ['title' => 'Xem trước thời gian thực', 'description' => 'Xem các thay đổi ngay lập tức khi AI xây dựng dự án của bạn. Không chờ đợi, không làm mới trang.', 'icon' => 'Eye', 'size' => 'medium'],
                ['title' => 'Trình soạn thảo mã tích hợp', 'description' => 'Trình soạn thảo Monaco đầy đủ với tô sáng cú pháp, cây tệp và tự động hoàn thành mã.', 'icon' => 'Code', 'size' => 'medium'],
                ['title' => 'Xuất và triển khai', 'description' => 'Lưu trữ trên nền tảng của chúng tôi hoặc xuất mã để triển khai ở bất kỳ đâu.', 'icon' => 'Download', 'size' => 'small'],
                ['title' => 'Mẫu thông minh', 'description' => 'Bắt đầu với các mẫu được AI chọn phù hợp hoàn hảo với nhu cầu dự án của bạn.', 'icon' => 'LayoutTemplate', 'size' => 'small'],
                ['title' => 'Cải tiến lặp đi lặp lại', 'description' => 'Tiếp tục trò chuyện để tinh chỉnh và cải thiện sản phẩm của bạn cho đến khi hoàn hảo.', 'icon' => 'MessageSquare', 'size' => 'small'],
                ['title' => 'Tên miền phụ tùy chỉnh', 'description' => 'Xuất bản dự án của bạn lên tên miền phụ tùy chỉnh và chia sẻ với thế giới.', 'icon' => 'Globe', 'size' => 'small'],
                ['title' => 'Chủ đề WordPress', 'description' => 'Tạo chủ đề WordPress block (FSE) có thể cài đặt từ một prompt — không cần thiết lập thủ công.', 'icon' => 'Newspaper', 'size' => 'medium', 'plugin_slug' => 'wordpress'],
                ['title' => 'Chủ đề Shopify', 'description' => 'Xây dựng chủ đề Online Store 2.0 và đẩy thẳng vào cửa hàng Shopify của bạn.', 'icon' => 'ShoppingBag', 'size' => 'medium', 'plugin_slug' => 'shopify'],
                ['title' => 'Đồng bộ GitHub', 'description' => 'Tự động đẩy mã nguồn được tạo vào kho GitHub riêng tư sau mỗi lần build.', 'icon' => 'Github', 'size' => 'small', 'plugin_slug' => 'github'],
                ['title' => 'Kết nối cơ sở dữ liệu', 'description' => 'Mang dự án Supabase của riêng bạn và để AI tạo xác thực và bảng cho ứng dụng.', 'icon' => 'Database', 'size' => 'small'],
                ['title' => 'Hệ thống thiết kế', 'description' => 'Thay thế toàn bộ nhận diện thương hiệu — màu sắc, phông chữ và token — mà không thay đổi bố cục.', 'icon' => 'Palette', 'size' => 'small'],
                ['title' => 'API cá nhân', 'description' => 'Truy cập tài khoản, dự án và mức sử dụng theo chương trình với khóa API chỉ đọc.', 'icon' => 'KeyRound', 'size' => 'small'],
                ['title' => 'Nhập giọng nói', 'description' => 'Mô tả dự án rảnh tay với tính năng nhập giọng nói gốc tích hợp sẵn trong trình duyệt.', 'icon' => 'Mic', 'size' => 'small'],
            ],
        ];

        // Use same item keys across locales for consistency
        $itemKeys = array_map(fn () => Str::uuid()->toString(), range(0, 13));

        // Stable per-card slug (index-aligned with every locale's array, matches the
        // data.ts ids). Lets the backfill identify cards without relying on titles.
        $canonicalKeys = [
            'ai-powered', 'real-time', 'code-editor', 'export', 'templates',
            'iterations', 'custom-subdomains', 'wordpress-themes', 'shopify-themes',
            'github-sync', 'supabase-db', 'design-systems', 'personal-api', 'voice-input',
        ];
        // The 7 cards introduced after the original launch — the only ones we append
        // to an already-seeded locale.
        $newCardKeys = array_slice($canonicalKeys, 7);

        foreach ($featureTranslations as $locale => $features) {
            // Stamp the stable key onto each card by index.
            foreach ($features as $index => $feature) {
                $features[$index]['key'] = $canonicalKeys[$index];
            }

            $existing = LandingItem::where('section_id', $section->id)
                ->where('locale', $locale)
                ->get();

            // Fresh locale: seed the full canonical set.
            if ($existing->isEmpty()) {
                foreach ($features as $index => $feature) {
                    LandingItem::create([
                        'section_id' => $section->id,
                        'locale' => $locale,
                        'item_key' => $itemKeys[$index],
                        'sort_order' => $index,
                        'is_enabled' => true,
                        'data' => $feature,
                    ]);
                }

                continue;
            }

            // Already-seeded locale: append only the new cards that are not present.
            // Plugin cards are matched by plugin_slug, always-on cards by stable key,
            // so the untagged original 7 are never re-added or duplicated.
            $nextSort = (int) $existing->max('sort_order') + 1;
            foreach ($features as $index => $feature) {
                if (! in_array($feature['key'], $newCardKeys, true)) {
                    continue;
                }

                $slug = $feature['plugin_slug'] ?? null;
                $present = $existing->contains(function ($item) use ($feature, $slug) {
                    // Stable key (present on rows seeded by this version onward).
                    if (($item->data['key'] ?? null) === $feature['key']) {
                        return true;
                    }
                    // Plugin cards: match the plugin slug.
                    if ($slug !== null && ($item->data['plugin_slug'] ?? null) === $slug) {
                        return true;
                    }

                    // Fallback for rows seeded before the stable key existed: every
                    // new card uses an icon not used by any original card, so an
                    // icon match uniquely identifies the card without a key.
                    return ($item->data['icon'] ?? null) === ($feature['icon'] ?? null);
                });

                if ($present) {
                    continue;
                }

                LandingItem::create([
                    'section_id' => $section->id,
                    'locale' => $locale,
                    'item_key' => $itemKeys[$index],
                    'sort_order' => $nextSort++,
                    'is_enabled' => true,
                    'data' => $feature,
                ]);
            }
        }
    }

    protected function seedProductShowcaseSection(): void
    {
        $section = LandingSection::where('type', 'product_showcase')->first();

        $translations = [
            'en' => [
                'title' => 'See it in action',
                'subtitle' => 'A powerful development environment that lets you chat with AI, edit code, and manage projects all in one place.',
            ],
            'ar' => [
                'title' => 'شاهده أثناء العمل',
                'subtitle' => 'بيئة تطوير قوية تتيح لك الدردشة مع الذكاء الاصطناعي وتحرير الكود وإدارة المشاريع في مكان واحد.',
            ],
            'de' => [
                'title' => 'Erleben Sie es in Aktion',
                'subtitle' => 'Eine leistungsstarke Entwicklungsumgebung zum Chatten mit KI, Code bearbeiten und Projekte verwalten.',
            ],
            'fr' => [
                'title' => 'Voyez-le en action',
                'subtitle' => 'Un environnement de développement puissant pour discuter avec l\'IA, éditer le code et gérer les projets.',
            ],
            'ja' => [
                'title' => '実際の動作を見る',
                'subtitle' => 'AIとのチャット、コード編集、プロジェクト管理をすべて一箇所で行える強力な開発環境。',
            ],
            'ru' => [
                'title' => 'Посмотрите в действии',
                'subtitle' => 'Мощная среда разработки для общения с ИИ, редактирования кода и управления проектами.',
            ],
            'it' => [
                'title' => 'Guardalo in azione',
                'subtitle' => 'Un potente ambiente di sviluppo che ti permette di chattare con l\'IA, modificare il codice e gestire progetti in un unico posto.',
            ],
            'zh' => [
                'title' => '观看实际演示',
                'subtitle' => '一个强大的开发环境，让您可以与AI聊天、编辑代码和管理项目，一切尽在一处。',
            ],
            'id' => [
                'title' => 'Lihat dalam aksi',
                'subtitle' => 'Lingkungan pengembangan yang memungkinkan Anda mengobrol dengan AI, mengedit kode, dan mengelola proyek dalam satu tempat.',
            ],
            'pt' => [
                'title' => 'Veja em ação',
                'subtitle' => 'Um ambiente de desenvolvimento poderoso que permite conversar com a IA, editar código e gerenciar projetos em um só lugar.',
            ],
            'es' => [
                'title' => 'Vélo en acción',
                'subtitle' => 'Un entorno de desarrollo potente que te permite chatear con la IA, editar código y gestionar proyectos en un solo lugar.',
            ],
            'ko' => [
                'title' => '실제로 작동하는 모습 보기',
                'subtitle' => 'AI와 채팅하고, 코드를 편집하고, 프로젝트를 관리할 수 있는 강력한 개발 환경 — 한 곳에서 모두.',
            ],
            'vi' => [
                'title' => 'Xem nó hoạt động',
                'subtitle' => 'Môi trường phát triển mạnh mẽ cho phép bạn trò chuyện với AI, chỉnh sửa mã và quản lý dự án ở một nơi.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }
    }

    protected function seedUseCasesSection(): void
    {
        $section = LandingSection::where('type', 'use_cases')->first();

        $translations = [
            'en' => [
                'title' => 'Built for everyone',
                'subtitle' => 'Whether you\'re a developer, designer, or entrepreneur, our platform helps you build faster and smarter.',
            ],
            'ar' => [
                'title' => 'مصمم للجميع',
                'subtitle' => 'سواء كنت مطوراً أو مصمماً أو رائد أعمال، منصتنا تساعدك على البناء بشكل أسرع وأذكى.',
            ],
            'de' => [
                'title' => 'Für alle entwickelt',
                'subtitle' => 'Ob Entwickler, Designer oder Unternehmer - unsere Plattform hilft Ihnen, schneller und intelligenter zu bauen.',
            ],
            'fr' => [
                'title' => 'Conçu pour tous',
                'subtitle' => 'Que vous soyez développeur, designer ou entrepreneur, notre plateforme vous aide à construire plus vite.',
            ],
            'ja' => [
                'title' => 'すべての人のために',
                'subtitle' => '開発者、デザイナー、起業家、誰でも私たちのプラットフォームでより速く、よりスマートに構築できます。',
            ],
            'ru' => [
                'title' => 'Создано для всех',
                'subtitle' => 'Разработчик, дизайнер или предприниматель — наша платформа поможет вам строить быстрее и умнее.',
            ],
            'it' => [
                'title' => 'Pensato per tutti',
                'subtitle' => 'Che tu sia uno sviluppatore, un designer o un imprenditore, la nostra piattaforma ti aiuta a costruire più velocemente e in modo più intelligente.',
            ],
            'zh' => [
                'title' => '为每个人而建',
                'subtitle' => '无论您是开发者、设计师还是企业家，我们的平台都能帮助您更快、更智能地构建。',
            ],
            'id' => [
                'title' => 'Dibangun untuk semua orang',
                'subtitle' => 'Baik Anda pengembang, desainer, atau pengusaha, platform kami membantu Anda membangun lebih cepat dan lebih cerdas.',
            ],
            'pt' => [
                'title' => 'Feito para todos',
                'subtitle' => 'Seja você desenvolvedor, designer ou empreendedor, nossa plataforma ajuda você a construir mais rápido e de forma mais inteligente.',
            ],
            'es' => [
                'title' => 'Hecho para todos',
                'subtitle' => 'Ya seas desarrollador, diseñador o emprendedor, nuestra plataforma te ayuda a construir más rápido y de forma más inteligente.',
            ],
            'ko' => [
                'title' => '모두를 위해 만들어졌습니다',
                'subtitle' => '개발자, 디자이너, 기업가 누구든 우리 플랫폼이 더 빠르고 스마트하게 구축하도록 도와줍니다.',
            ],
            'vi' => [
                'title' => 'Xây dựng cho mọi người',
                'subtitle' => 'Dù bạn là nhà phát triển, nhà thiết kế hay doanh nhân, nền tảng của chúng tôi giúp bạn xây dựng nhanh hơn và thông minh hơn.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }

        // Create persona items
        $personaTranslations = [
            'en' => [
                ['title' => 'Developers', 'description' => 'Accelerate your workflow with AI-assisted development. Focus on logic while AI handles boilerplate.', 'icon' => 'Terminal'],
                ['title' => 'Entrepreneurs', 'description' => 'Launch your MVP faster. Go from idea to working prototype in minutes, not weeks.', 'icon' => 'Rocket'],
                ['title' => 'Designers', 'description' => 'Bring your designs to life without writing code. Describe your vision and see it built.', 'icon' => 'Palette'],
                ['title' => 'Agencies', 'description' => 'Deliver more projects in less time. Scale your output without scaling your team.', 'icon' => 'Building'],
            ],
            'ar' => [
                ['title' => 'المطورون', 'description' => 'سرّع سير عملك مع التطوير بمساعدة الذكاء الاصطناعي. ركز على المنطق بينما يتولى الذكاء الاصطناعي الأكواد المتكررة.', 'icon' => 'Terminal'],
                ['title' => 'رواد الأعمال', 'description' => 'أطلق منتجك الأولي بشكل أسرع. انتقل من الفكرة إلى نموذج عمل في دقائق.', 'icon' => 'Rocket'],
                ['title' => 'المصممون', 'description' => 'حوّل تصاميمك إلى واقع بدون كتابة كود. صف رؤيتك وشاهدها تُبنى.', 'icon' => 'Palette'],
                ['title' => 'الوكالات', 'description' => 'أنجز المزيد من المشاريع في وقت أقل. وسّع إنتاجك دون توسيع فريقك.', 'icon' => 'Building'],
            ],
            'de' => [
                ['title' => 'Entwickler', 'description' => 'Beschleunigen Sie Ihren Workflow mit KI-unterstützter Entwicklung.', 'icon' => 'Terminal'],
                ['title' => 'Unternehmer', 'description' => 'Starten Sie Ihr MVP schneller. Von der Idee zum Prototyp in Minuten.', 'icon' => 'Rocket'],
                ['title' => 'Designer', 'description' => 'Erwecken Sie Ihre Designs zum Leben ohne Code zu schreiben.', 'icon' => 'Palette'],
                ['title' => 'Agenturen', 'description' => 'Liefern Sie mehr Projekte in kürzerer Zeit. Skalieren Sie ohne mehr Personal.', 'icon' => 'Building'],
            ],
            'fr' => [
                ['title' => 'Développeurs', 'description' => 'Accélérez votre flux de travail avec le développement assisté par IA.', 'icon' => 'Terminal'],
                ['title' => 'Entrepreneurs', 'description' => 'Lancez votre MVP plus rapidement. De l\'idée au prototype en quelques minutes.', 'icon' => 'Rocket'],
                ['title' => 'Designers', 'description' => 'Donnez vie à vos designs sans écrire de code. Décrivez votre vision.', 'icon' => 'Palette'],
                ['title' => 'Agences', 'description' => 'Livrez plus de projets en moins de temps. Augmentez votre production.', 'icon' => 'Building'],
            ],
            'ja' => [
                ['title' => '開発者', 'description' => 'AI支援開発でワークフローを加速。ロジックに集中し、AIが定型コードを処理。', 'icon' => 'Terminal'],
                ['title' => '起業家', 'description' => 'MVPをより早く立ち上げ。アイデアから動くプロトタイプまで数分で。', 'icon' => 'Rocket'],
                ['title' => 'デザイナー', 'description' => 'コードを書かずにデザインを実現。ビジョンを説明するだけ。', 'icon' => 'Palette'],
                ['title' => 'エージェンシー', 'description' => 'より短時間でより多くのプロジェクトを納品。チームを増やさずに生産性を拡大。', 'icon' => 'Building'],
            ],
            'ru' => [
                ['title' => 'Разработчики', 'description' => 'Ускорьте рабочий процесс с помощью ИИ. Сосредоточьтесь на логике.', 'icon' => 'Terminal'],
                ['title' => 'Предприниматели', 'description' => 'Запустите MVP быстрее. От идеи до прототипа за минуты.', 'icon' => 'Rocket'],
                ['title' => 'Дизайнеры', 'description' => 'Воплотите дизайн без написания кода. Опишите видение — увидьте результат.', 'icon' => 'Palette'],
                ['title' => 'Агентства', 'description' => 'Выполняйте больше проектов за меньшее время. Масштабируйтесь без найма.', 'icon' => 'Building'],
            ],
            'it' => [
                ['title' => 'Sviluppatori', 'description' => 'Accelera il tuo flusso di lavoro con lo sviluppo assistito dall\'IA. Concentrati sulla logica.', 'icon' => 'Terminal'],
                ['title' => 'Imprenditori', 'description' => 'Lancia il tuo MVP più velocemente. Dall\'idea al prototipo in pochi minuti.', 'icon' => 'Rocket'],
                ['title' => 'Designer', 'description' => 'Dai vita ai tuoi design senza scrivere codice. Descrivi la tua visione.', 'icon' => 'Palette'],
                ['title' => 'Agenzie', 'description' => 'Consegna più progetti in meno tempo. Scala la produzione senza ampliare il team.', 'icon' => 'Building'],
            ],
            'zh' => [
                ['title' => '开发者', 'description' => '借助AI辅助开发加速工作流程。专注于逻辑，让AI处理模板代码。', 'icon' => 'Terminal'],
                ['title' => '创业者', 'description' => '更快推出您的MVP。几分钟内从创意到可运行的原型。', 'icon' => 'Rocket'],
                ['title' => '设计师', 'description' => '无需编写代码即可实现设计。描述您的愿景，看着它被构建出来。', 'icon' => 'Palette'],
                ['title' => '代理机构', 'description' => '在更短时间内交付更多项目。无需扩大团队即可扩展产出。', 'icon' => 'Building'],
            ],
            'id' => [
                ['title' => 'Pengembang', 'description' => 'Percepat alur kerja Anda dengan pengembangan berbantuan AI. Fokus pada logika.', 'icon' => 'Terminal'],
                ['title' => 'Pengusaha', 'description' => 'Luncurkan MVP Anda lebih cepat. Dari ide ke prototipe dalam hitungan menit.', 'icon' => 'Rocket'],
                ['title' => 'Desainer', 'description' => 'Wujudkan desain Anda tanpa menulis kode. Jelaskan visi Anda.', 'icon' => 'Palette'],
                ['title' => 'Agensi', 'description' => 'Selesaikan lebih banyak proyek dalam waktu lebih singkat. Skalakan tanpa menambah tim.', 'icon' => 'Building'],
            ],
            'pt' => [
                ['title' => 'Desenvolvedores', 'description' => 'Acelere seu fluxo de trabalho com desenvolvimento assistido por IA. Foque na lógica.', 'icon' => 'Terminal'],
                ['title' => 'Empreendedores', 'description' => 'Lance seu MVP mais rápido. Da ideia ao protótipo funcional em minutos.', 'icon' => 'Rocket'],
                ['title' => 'Designers', 'description' => 'Dê vida aos seus designs sem escrever código. Descreva sua visão.', 'icon' => 'Palette'],
                ['title' => 'Agências', 'description' => 'Entregue mais projetos em menos tempo. Escale sem aumentar a equipe.', 'icon' => 'Building'],
            ],
            'es' => [
                ['title' => 'Desarrolladores', 'description' => 'Acelera tu flujo de trabajo con desarrollo asistido por IA. Concéntrate en la lógica.', 'icon' => 'Terminal'],
                ['title' => 'Emprendedores', 'description' => 'Lanza tu MVP más rápido. De la idea al prototipo funcional en minutos.', 'icon' => 'Rocket'],
                ['title' => 'Diseñadores', 'description' => 'Da vida a tus diseños sin escribir código. Describe tu visión.', 'icon' => 'Palette'],
                ['title' => 'Agencias', 'description' => 'Entrega más proyectos en menos tiempo. Escala sin aumentar el equipo.', 'icon' => 'Building'],
            ],
            'ko' => [
                ['title' => '개발자', 'description' => 'AI 지원 개발로 워크플로를 가속화하세요. 로직에 집중하고 AI가 보일러플레이트를 처리합니다.', 'icon' => 'Terminal'],
                ['title' => '기업가', 'description' => 'MVP를 더 빨리 출시하세요. 아이디어에서 작동하는 프로토타입까지 몇 분 만에.', 'icon' => 'Rocket'],
                ['title' => '디자이너', 'description' => '코드 없이 디자인을 실현하세요. 비전을 설명하면 구축됩니다.', 'icon' => 'Palette'],
                ['title' => '에이전시', 'description' => '더 짧은 시간에 더 많은 프로젝트를 납품하세요. 팀을 늘리지 않고 생산성을 확장하세요.', 'icon' => 'Building'],
            ],
            'vi' => [
                ['title' => 'Nhà phát triển', 'description' => 'Tăng tốc quy trình làm việc với phát triển hỗ trợ AI. Tập trung vào logic trong khi AI xử lý boilerplate.', 'icon' => 'Terminal'],
                ['title' => 'Doanh nhân', 'description' => 'Ra mắt MVP nhanh hơn. Từ ý tưởng đến nguyên mẫu hoạt động trong vài phút.', 'icon' => 'Rocket'],
                ['title' => 'Nhà thiết kế', 'description' => 'Hiện thực hóa thiết kế mà không cần viết mã. Mô tả tầm nhìn và xem nó được xây dựng.', 'icon' => 'Palette'],
                ['title' => 'Các agency', 'description' => 'Giao nhiều dự án hơn trong ít thời gian hơn. Mở rộng quy mô mà không cần tăng nhân sự.', 'icon' => 'Building'],
            ],
        ];

        $itemKeys = array_map(fn () => Str::uuid()->toString(), range(0, 3));

        foreach ($personaTranslations as $locale => $personas) {
            // Additive: only seed items for a locale that has none yet (fills new
            // locales on upgrade; a no-op where the operator already has them).
            if (LandingItem::where('section_id', $section->id)->where('locale', $locale)->exists()) {
                continue;
            }
            foreach ($personas as $index => $persona) {
                LandingItem::create([
                    'section_id' => $section->id,
                    'locale' => $locale,
                    'item_key' => $itemKeys[$index],
                    'sort_order' => $index,
                    'is_enabled' => true,
                    'data' => $persona,
                ]);
            }
        }
    }

    protected function seedPricingSection(): void
    {
        $section = LandingSection::where('type', 'pricing')->first();

        $translations = [
            'en' => [
                'title' => 'Simple, transparent pricing',
                'subtitle' => 'Choose the plan that\'s right for you. No hidden fees.',
            ],
            'ar' => [
                'title' => 'أسعار بسيطة وشفافة',
                'subtitle' => 'اختر الخطة المناسبة لك. لا رسوم خفية.',
            ],
            'de' => [
                'title' => 'Einfache, transparente Preise',
                'subtitle' => 'Wählen Sie den richtigen Plan. Keine versteckten Gebühren.',
            ],
            'fr' => [
                'title' => 'Tarification simple et transparente',
                'subtitle' => 'Choisissez le plan qui vous convient. Pas de frais cachés.',
            ],
            'ja' => [
                'title' => 'シンプルで透明な料金',
                'subtitle' => 'あなたに合ったプランを選択。隠れた料金はありません。',
            ],
            'ru' => [
                'title' => 'Простые и прозрачные цены',
                'subtitle' => 'Выберите подходящий план. Никаких скрытых платежей.',
            ],
            'it' => [
                'title' => 'Prezzi semplici e trasparenti',
                'subtitle' => 'Scegli il piano giusto per te. Nessun costo nascosto.',
            ],
            'zh' => [
                'title' => '简单透明的定价',
                'subtitle' => '选择适合您的计划。没有隐藏费用。',
            ],
            'id' => [
                'title' => 'Harga sederhana dan transparan',
                'subtitle' => 'Pilih paket yang tepat untuk Anda. Tanpa biaya tersembunyi.',
            ],
            'pt' => [
                'title' => 'Preços simples e transparentes',
                'subtitle' => 'Escolha o plano ideal para você. Sem taxas ocultas.',
            ],
            'es' => [
                'title' => 'Precios simples y transparentes',
                'subtitle' => 'Elige el plan que más te convenga. Sin tarifas ocultas.',
            ],
            'ko' => [
                'title' => '단순하고 투명한 요금제',
                'subtitle' => '나에게 맞는 플랜을 선택하세요. 숨겨진 요금 없음.',
            ],
            'vi' => [
                'title' => 'Giá đơn giản, minh bạch',
                'subtitle' => 'Chọn gói phù hợp với bạn. Không có phí ẩn.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }
    }

    protected function seedCategoriesSection(): void
    {
        $section = LandingSection::where('type', 'categories')->first();

        $translations = [
            'en' => [
                'title' => 'What will you build?',
                'subtitle' => 'From landing pages to complex web applications, explore what you can create.',
            ],
            'ar' => [
                'title' => 'ماذا ستبني؟',
                'subtitle' => 'من صفحات الهبوط إلى تطبيقات الويب المعقدة، اكتشف ما يمكنك إنشاؤه.',
            ],
            'de' => [
                'title' => 'Was werden Sie bauen?',
                'subtitle' => 'Von Landing Pages bis zu komplexen Webanwendungen - entdecken Sie Ihre Möglichkeiten.',
            ],
            'fr' => [
                'title' => 'Que allez-vous créer ?',
                'subtitle' => 'Des pages d\'atterrissage aux applications web complexes, explorez vos possibilités.',
            ],
            'ja' => [
                'title' => '何を作りますか？',
                'subtitle' => 'ランディングページから複雑なWebアプリまで、作成できるものを探索しましょう。',
            ],
            'ru' => [
                'title' => 'Что вы создадите?',
                'subtitle' => 'От лендингов до сложных веб-приложений — исследуйте возможности.',
            ],
            'it' => [
                'title' => 'Cosa costruirai?',
                'subtitle' => 'Dalle landing page alle applicazioni web complesse, esplora cosa puoi creare.',
            ],
            'zh' => [
                'title' => '您将构建什么？',
                'subtitle' => '从着陆页到复杂的Web应用程序，探索您可以创建的内容。',
            ],
            'id' => [
                'title' => 'Apa yang akan Anda bangun?',
                'subtitle' => 'Dari halaman landing hingga aplikasi web kompleks, jelajahi apa yang dapat Anda buat.',
            ],
            'pt' => [
                'title' => 'O que você vai construir?',
                'subtitle' => 'De landing pages a aplicações web complexas, explore o que você pode criar.',
            ],
            'es' => [
                'title' => '¿Qué vas a construir?',
                'subtitle' => 'Desde páginas de aterrizaje hasta aplicaciones web complejas, explora lo que puedes crear.',
            ],
            'ko' => [
                'title' => '무엇을 만드실 건가요?',
                'subtitle' => '랜딩 페이지부터 복잡한 웹 애플리케이션까지, 만들 수 있는 것을 탐색해 보세요.',
            ],
            'vi' => [
                'title' => 'Bạn sẽ xây dựng gì?',
                'subtitle' => 'Từ trang đích đến các ứng dụng web phức tạp, khám phá những gì bạn có thể tạo ra.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }

        // Create category items
        $categoryTranslations = [
            'en' => [
                ['name' => 'Landing Pages', 'icon' => 'Layout'],
                ['name' => 'Dashboards', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portfolios', 'icon' => 'Briefcase'],
                ['name' => 'Web Apps', 'icon' => 'Globe'],
                ['name' => 'Admin Panels', 'icon' => 'Settings'],
            ],
            'ar' => [
                ['name' => 'صفحات الهبوط', 'icon' => 'Layout'],
                ['name' => 'لوحات التحكم', 'icon' => 'LayoutDashboard'],
                ['name' => 'التجارة الإلكترونية', 'icon' => 'ShoppingCart'],
                ['name' => 'معارض الأعمال', 'icon' => 'Briefcase'],
                ['name' => 'تطبيقات الويب', 'icon' => 'Globe'],
                ['name' => 'لوحات الإدارة', 'icon' => 'Settings'],
            ],
            'de' => [
                ['name' => 'Landing Pages', 'icon' => 'Layout'],
                ['name' => 'Dashboards', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-Commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portfolios', 'icon' => 'Briefcase'],
                ['name' => 'Web-Apps', 'icon' => 'Globe'],
                ['name' => 'Admin-Panels', 'icon' => 'Settings'],
            ],
            'fr' => [
                ['name' => 'Pages d\'atterrissage', 'icon' => 'Layout'],
                ['name' => 'Tableaux de bord', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portfolios', 'icon' => 'Briefcase'],
                ['name' => 'Applications web', 'icon' => 'Globe'],
                ['name' => 'Panneaux d\'admin', 'icon' => 'Settings'],
            ],
            'ja' => [
                ['name' => 'ランディングページ', 'icon' => 'Layout'],
                ['name' => 'ダッシュボード', 'icon' => 'LayoutDashboard'],
                ['name' => 'Eコマース', 'icon' => 'ShoppingCart'],
                ['name' => 'ポートフォリオ', 'icon' => 'Briefcase'],
                ['name' => 'Webアプリ', 'icon' => 'Globe'],
                ['name' => '管理パネル', 'icon' => 'Settings'],
            ],
            'ru' => [
                ['name' => 'Лендинги', 'icon' => 'Layout'],
                ['name' => 'Дашборды', 'icon' => 'LayoutDashboard'],
                ['name' => 'Интернет-магазины', 'icon' => 'ShoppingCart'],
                ['name' => 'Портфолио', 'icon' => 'Briefcase'],
                ['name' => 'Веб-приложения', 'icon' => 'Globe'],
                ['name' => 'Админ-панели', 'icon' => 'Settings'],
            ],
            'it' => [
                ['name' => 'Landing Page', 'icon' => 'Layout'],
                ['name' => 'Dashboard', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portfolio', 'icon' => 'Briefcase'],
                ['name' => 'App Web', 'icon' => 'Globe'],
                ['name' => 'Pannelli Admin', 'icon' => 'Settings'],
            ],
            'zh' => [
                ['name' => '着陆页', 'icon' => 'Layout'],
                ['name' => '仪表板', 'icon' => 'LayoutDashboard'],
                ['name' => '电子商务', 'icon' => 'ShoppingCart'],
                ['name' => '作品集', 'icon' => 'Briefcase'],
                ['name' => 'Web应用', 'icon' => 'Globe'],
                ['name' => '管理面板', 'icon' => 'Settings'],
            ],
            'id' => [
                ['name' => 'Halaman Landing', 'icon' => 'Layout'],
                ['name' => 'Dashboard', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portofolio', 'icon' => 'Briefcase'],
                ['name' => 'Aplikasi Web', 'icon' => 'Globe'],
                ['name' => 'Panel Admin', 'icon' => 'Settings'],
            ],
            'pt' => [
                ['name' => 'Landing Pages', 'icon' => 'Layout'],
                ['name' => 'Dashboards', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portfólios', 'icon' => 'Briefcase'],
                ['name' => 'Aplicações Web', 'icon' => 'Globe'],
                ['name' => 'Painéis Admin', 'icon' => 'Settings'],
            ],
            'es' => [
                ['name' => 'Páginas de aterrizaje', 'icon' => 'Layout'],
                ['name' => 'Paneles', 'icon' => 'LayoutDashboard'],
                ['name' => 'E-commerce', 'icon' => 'ShoppingCart'],
                ['name' => 'Portafolios', 'icon' => 'Briefcase'],
                ['name' => 'Aplicaciones web', 'icon' => 'Globe'],
                ['name' => 'Paneles de admin', 'icon' => 'Settings'],
            ],
            'ko' => [
                ['name' => '랜딩 페이지', 'icon' => 'Layout'],
                ['name' => '대시보드', 'icon' => 'LayoutDashboard'],
                ['name' => '전자상거래', 'icon' => 'ShoppingCart'],
                ['name' => '포트폴리오', 'icon' => 'Briefcase'],
                ['name' => '웹 앱', 'icon' => 'Globe'],
                ['name' => '관리 패널', 'icon' => 'Settings'],
            ],
            'vi' => [
                ['name' => 'Trang đích', 'icon' => 'Layout'],
                ['name' => 'Bảng điều khiển', 'icon' => 'LayoutDashboard'],
                ['name' => 'Thương mại điện tử', 'icon' => 'ShoppingCart'],
                ['name' => 'Hồ sơ năng lực', 'icon' => 'Briefcase'],
                ['name' => 'Ứng dụng web', 'icon' => 'Globe'],
                ['name' => 'Bảng quản trị', 'icon' => 'Settings'],
            ],
        ];

        $itemKeys = array_map(fn () => Str::uuid()->toString(), range(0, 5));

        foreach ($categoryTranslations as $locale => $categories) {
            // Additive: only seed items for a locale that has none yet.
            if (LandingItem::where('section_id', $section->id)->where('locale', $locale)->exists()) {
                continue;
            }
            foreach ($categories as $index => $category) {
                LandingItem::create([
                    'section_id' => $section->id,
                    'locale' => $locale,
                    'item_key' => $itemKeys[$index],
                    'sort_order' => $index,
                    'is_enabled' => true,
                    'data' => $category,
                ]);
            }
        }
    }

    protected function seedTrustedBySection(): void
    {
        $section = LandingSection::where('type', 'trusted_by')->first();

        $translations = [
            'en' => ['title' => 'Trusted by teams at'],
            'ar' => ['title' => 'موثوق به من فرق في'],
            'de' => ['title' => 'Vertraut von Teams bei'],
            'fr' => ['title' => 'Fait confiance par les équipes de'],
            'ja' => ['title' => '信頼されているチーム'],
            'ru' => ['title' => 'Нам доверяют команды'],
            'it' => ['title' => 'Scelto dai team di'],
            'zh' => ['title' => '受到以下团队的信赖'],
            'id' => ['title' => 'Dipercaya oleh tim di'],
            'pt' => ['title' => 'Confiado por equipes de'],
            'es' => ['title' => 'Confiado por equipos de'],
            'ko' => ['title' => '다음 팀에서 신뢰합니다'],
            'vi' => ['title' => 'Được tin tưởng bởi các nhóm tại'],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }

        // Company logos are the same across locales (brand names don't translate)
        $companies = [
            ['name' => 'TechCorp', 'initial' => 'T', 'color' => 'bg-blue-500'],
            ['name' => 'StartupHQ', 'initial' => 'S', 'color' => 'bg-green-500'],
            ['name' => 'DesignCo', 'initial' => 'D', 'color' => 'bg-purple-500'],
            ['name' => 'DevAgency', 'initial' => 'A', 'color' => 'bg-orange-500'],
            ['name' => 'BuilderInc', 'initial' => 'B', 'color' => 'bg-pink-500'],
        ];

        // Only create for English since logos are language-independent.
        // Additive: skip if already seeded so re-runs don't duplicate.
        if (! LandingItem::where('section_id', $section->id)->where('locale', 'en')->exists()) {
            foreach ($companies as $index => $company) {
                LandingItem::create([
                    'section_id' => $section->id,
                    'locale' => 'en',
                    'item_key' => Str::uuid()->toString(),
                    'sort_order' => $index,
                    'is_enabled' => true,
                    'data' => $company,
                ]);
            }
        }
    }

    protected function seedTestimonialsSection(): void
    {
        $section = LandingSection::where('type', 'testimonials')->first();

        $translations = [
            'en' => [
                'title' => 'What our users say',
                'subtitle' => 'Join thousands of satisfied customers who have transformed their workflow.',
            ],
            'ar' => [
                'title' => 'ماذا يقول مستخدمونا',
                'subtitle' => 'انضم إلى آلاف العملاء الراضين الذين غيّروا طريقة عملهم.',
            ],
            'de' => [
                'title' => 'Was unsere Nutzer sagen',
                'subtitle' => 'Schließen Sie sich Tausenden zufriedener Kunden an.',
            ],
            'fr' => [
                'title' => 'Ce que disent nos utilisateurs',
                'subtitle' => 'Rejoignez des milliers de clients satisfaits.',
            ],
            'ja' => [
                'title' => 'ユーザーの声',
                'subtitle' => 'ワークフローを変革した何千もの満足したお客様に加わりましょう。',
            ],
            'ru' => [
                'title' => 'Отзывы пользователей',
                'subtitle' => 'Присоединяйтесь к тысячам довольных клиентов.',
            ],
            'it' => [
                'title' => 'Cosa dicono i nostri utenti',
                'subtitle' => 'Unisciti a migliaia di clienti soddisfatti che hanno trasformato il loro flusso di lavoro.',
            ],
            'zh' => [
                'title' => '用户评价',
                'subtitle' => '加入数千名满意客户的行列，他们已经改变了自己的工作方式。',
            ],
            'id' => [
                'title' => 'Apa kata pengguna kami',
                'subtitle' => 'Bergabunglah dengan ribuan pelanggan puas yang telah mengubah alur kerja mereka.',
            ],
            'pt' => [
                'title' => 'O que nossos usuários dizem',
                'subtitle' => 'Junte-se a milhares de clientes satisfeitos que transformaram seu fluxo de trabalho.',
            ],
            'es' => [
                'title' => 'Lo que dicen nuestros usuarios',
                'subtitle' => 'Únete a miles de clientes satisfechos que han transformado su flujo de trabajo.',
            ],
            'ko' => [
                'title' => '사용자들의 이야기',
                'subtitle' => '워크플로를 혁신한 수천 명의 만족한 고객과 함께하세요.',
            ],
            'vi' => [
                'title' => 'Người dùng nói gì',
                'subtitle' => 'Tham gia cùng hàng nghìn khách hàng hài lòng đã chuyển đổi quy trình làm việc của họ.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }

        // Sample testimonials - only English for now (testimonials are typically real quotes)
        $testimonials = [
            [
                'quote' => 'This tool completely changed how we build prototypes. What used to take weeks now takes hours.',
                'author' => 'Sarah Chen',
                'role' => 'Product Manager at TechStart',
                'avatar' => null,
                'rating' => 5,
            ],
            [
                'quote' => 'The AI understands exactly what I want. It\'s like having a senior developer on my team.',
                'author' => 'Marcus Johnson',
                'role' => 'Founder at BuildFast',
                'avatar' => null,
                'rating' => 5,
            ],
            [
                'quote' => 'I launched my startup\'s website in a single afternoon. Absolutely incredible.',
                'author' => 'Emily Rodriguez',
                'role' => 'CEO at LaunchPad',
                'avatar' => null,
                'rating' => 5,
            ],
        ];

        // Additive: skip if already seeded so re-runs don't duplicate.
        if (! LandingItem::where('section_id', $section->id)->where('locale', 'en')->exists()) {
            foreach ($testimonials as $index => $testimonial) {
                LandingItem::create([
                    'section_id' => $section->id,
                    'locale' => 'en',
                    'item_key' => Str::uuid()->toString(),
                    'sort_order' => $index,
                    'is_enabled' => true,
                    'data' => $testimonial,
                ]);
            }
        }
    }

    protected function seedFaqSection(): void
    {
        $section = LandingSection::where('type', 'faq')->first();

        $translations = [
            'en' => [
                'title' => 'Frequently asked questions',
                'subtitle' => 'Got questions? We\'ve got answers.',
            ],
            'ar' => [
                'title' => 'الأسئلة الشائعة',
                'subtitle' => 'لديك أسئلة؟ لدينا الإجابات.',
            ],
            'de' => [
                'title' => 'Häufig gestellte Fragen',
                'subtitle' => 'Haben Sie Fragen? Wir haben Antworten.',
            ],
            'fr' => [
                'title' => 'Questions fréquentes',
                'subtitle' => 'Des questions ? Nous avons les réponses.',
            ],
            'ja' => [
                'title' => 'よくある質問',
                'subtitle' => '質問がありますか？お答えします。',
            ],
            'ru' => [
                'title' => 'Часто задаваемые вопросы',
                'subtitle' => 'Есть вопросы? У нас есть ответы.',
            ],
            'it' => [
                'title' => 'Domande frequenti',
                'subtitle' => 'Hai domande? Abbiamo le risposte.',
            ],
            'zh' => [
                'title' => '常见问题',
                'subtitle' => '有疑问？我们为您解答。',
            ],
            'id' => [
                'title' => 'Pertanyaan yang sering diajukan',
                'subtitle' => 'Punya pertanyaan? Kami punya jawabannya.',
            ],
            'pt' => [
                'title' => 'Perguntas frequentes',
                'subtitle' => 'Tem perguntas? Temos respostas.',
            ],
            'es' => [
                'title' => 'Preguntas frecuentes',
                'subtitle' => '¿Tienes preguntas? Tenemos respuestas.',
            ],
            'ko' => [
                'title' => '자주 묻는 질문',
                'subtitle' => '질문이 있으신가요? 답변을 드립니다.',
            ],
            'vi' => [
                'title' => 'Câu hỏi thường gặp',
                'subtitle' => 'Có câu hỏi? Chúng tôi có câu trả lời.',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }

        // FAQ items with translations
        $faqTranslations = [
            'en' => [
                ['question' => 'How does the AI build websites?', 'answer' => 'Our AI analyzes your description and generates clean, production-ready code. It understands context, follows best practices, and creates responsive designs automatically.'],
                ['question' => 'Can I export my code?', 'answer' => 'Yes! You can export your complete project as a zip file and deploy it anywhere. The code is clean, well-organized, and uses modern frameworks.'],
                ['question' => 'What technologies are supported?', 'answer' => 'Our AI generates modern, production-ready code tailored to your chosen output — React, TypeScript, and Tailwind CSS for websites, plus installable CMS and store themes. Everything follows best practices and stays fully customizable.'],
                ['question' => 'Is there a free plan?', 'answer' => 'Yes, we offer a free plan with limited build credits so you can try the platform. Upgrade anytime to unlock more features and credits.'],
            ],
            'ar' => [
                ['question' => 'كيف يبني الذكاء الاصطناعي المواقع؟', 'answer' => 'يحلل الذكاء الاصطناعي وصفك ويولّد كوداً نظيفاً جاهزاً للإنتاج. يفهم السياق ويتبع أفضل الممارسات وينشئ تصاميم متجاوبة تلقائياً.'],
                ['question' => 'هل يمكنني تصدير الكود؟', 'answer' => 'نعم! يمكنك تصدير مشروعك الكامل كملف مضغوط ونشره في أي مكان. الكود نظيف ومنظم ويستخدم أطر عمل حديثة.'],
                ['question' => 'ما هي التقنيات المدعومة؟', 'answer' => 'يُنشئ الذكاء الاصطناعي لدينا كوداً حديثاً جاهزاً للإنتاج مصمماً وفق المخرج الذي تختاره — React وTypeScript وTailwind CSS للمواقع، إضافة إلى قوالب CMS ومتاجر قابلة للتثبيت. كل شيء يتبع أفضل الممارسات وقابل للتخصيص بالكامل.'],
                ['question' => 'هل هناك خطة مجانية؟', 'answer' => 'نعم، نقدم خطة مجانية مع رصيد بناء محدود لتجربة المنصة. يمكنك الترقية في أي وقت.'],
            ],
            'de' => [
                ['question' => 'Wie baut die KI Websites?', 'answer' => 'Unsere KI analysiert Ihre Beschreibung und generiert sauberen, produktionsreifen Code mit responsivem Design.'],
                ['question' => 'Kann ich meinen Code exportieren?', 'answer' => 'Ja! Sie können Ihr Projekt als ZIP-Datei exportieren und überall bereitstellen.'],
                ['question' => 'Welche Technologien werden unterstützt?', 'answer' => 'Unsere KI generiert modernen, produktionsreifen Code, der auf Ihre gewählte Ausgabe zugeschnitten ist — React, TypeScript und Tailwind CSS für Websites sowie installierbare CMS- und Shop-Themes. Alles folgt Best Practices und bleibt vollständig anpassbar.'],
                ['question' => 'Gibt es einen kostenlosen Plan?', 'answer' => 'Ja, wir bieten einen kostenlosen Plan mit begrenzten Credits zum Ausprobieren.'],
            ],
            'fr' => [
                ['question' => 'Comment l\'IA construit-elle les sites ?', 'answer' => 'Notre IA analyse votre description et génère du code propre, prêt pour la production, avec un design responsive.'],
                ['question' => 'Puis-je exporter mon code ?', 'answer' => 'Oui ! Vous pouvez exporter votre projet en fichier ZIP et le déployer n\'importe où.'],
                ['question' => 'Quelles technologies sont supportées ?', 'answer' => 'Notre IA génère du code moderne et prêt pour la production, adapté à la sortie choisie — React, TypeScript et Tailwind CSS pour les sites web, ainsi que des thèmes CMS et boutiques installables. Tout suit les bonnes pratiques et reste entièrement personnalisable.'],
                ['question' => 'Y a-t-il un plan gratuit ?', 'answer' => 'Oui, nous offrons un plan gratuit avec des crédits limités pour essayer la plateforme.'],
            ],
            'ja' => [
                ['question' => 'AIはどのようにウェブサイトを構築しますか？', 'answer' => '当社のAIは説明を分析し、クリーンで本番環境対応のコードを生成します。コンテキストを理解し、レスポンシブデザインを自動作成します。'],
                ['question' => 'コードをエクスポートできますか？', 'answer' => 'はい！プロジェクト全体をZIPファイルとしてエクスポートし、どこにでもデプロイできます。'],
                ['question' => 'どの技術がサポートされていますか？', 'answer' => '当社のAIは、選択した出力に合わせたモダンで本番環境対応のコードを生成します — ウェブサイト向けにはReact、TypeScript、Tailwind CSS、さらにインストール可能なCMSおよびストアテーマも提供。すべてベストプラクティスに従い、完全にカスタマイズ可能です。'],
                ['question' => '無料プランはありますか？', 'answer' => 'はい、プラットフォームを試すための限定クレジット付き無料プランを提供しています。'],
            ],
            'ru' => [
                ['question' => 'Как ИИ создаёт сайты?', 'answer' => 'Наш ИИ анализирует ваше описание и генерирует чистый, готовый к продакшену код с адаптивным дизайном.'],
                ['question' => 'Могу ли я экспортировать код?', 'answer' => 'Да! Вы можете экспортировать проект как ZIP-файл и развернуть его где угодно.'],
                ['question' => 'Какие технологии поддерживаются?', 'answer' => 'Наш ИИ генерирует современный, готовый к продакшену код, адаптированный к выбранному типу вывода — React, TypeScript и Tailwind CSS для сайтов, а также устанавливаемые темы для CMS и магазинов. Всё соответствует лучшим практикам и полностью настраивается.'],
                ['question' => 'Есть ли бесплатный план?', 'answer' => 'Да, мы предлагаем бесплатный план с ограниченными кредитами для пробного использования.'],
            ],
            'it' => [
                ['question' => 'Come fa l\'IA a costruire siti web?', 'answer' => 'La nostra IA analizza la tua descrizione e genera codice pulito e pronto per la produzione con design responsive.'],
                ['question' => 'Posso esportare il mio codice?', 'answer' => 'Sì! Puoi esportare il tuo progetto completo come file ZIP e distribuirlo ovunque.'],
                ['question' => 'Quali tecnologie sono supportate?', 'answer' => 'La nostra IA genera codice moderno e pronto per la produzione, adattato all\'output scelto — React, TypeScript e Tailwind CSS per i siti web, più temi CMS e negozi installabili. Tutto segue le best practice e rimane completamente personalizzabile.'],
                ['question' => 'C\'è un piano gratuito?', 'answer' => 'Sì, offriamo un piano gratuito con crediti limitati per provare la piattaforma.'],
            ],
            'zh' => [
                ['question' => 'AI如何构建网站？', 'answer' => '我们的AI分析您的描述，生成干净的、可用于生产环境的代码，并自动创建响应式设计。'],
                ['question' => '我可以导出代码吗？', 'answer' => '可以！您可以将完整项目导出为ZIP文件，部署到任何地方。'],
                ['question' => '支持哪些技术？', 'answer' => '我们的AI根据您选择的输出生成现代化、可投入生产的代码——网站使用React、TypeScript和Tailwind CSS，另外还有可安装的CMS和商店主题。一切均遵循最佳实践，并保持完全可定制性。'],
                ['question' => '有免费计划吗？', 'answer' => '有的，我们提供带有限额构建积分的免费计划，让您可以试用平台。'],
            ],
            'id' => [
                ['question' => 'Bagaimana AI membangun situs web?', 'answer' => 'AI kami menganalisis deskripsi Anda dan menghasilkan kode bersih yang siap produksi dengan desain responsif.'],
                ['question' => 'Bisakah saya mengekspor kode saya?', 'answer' => 'Ya! Anda dapat mengekspor proyek lengkap sebagai file ZIP dan men-deploy-nya di mana saja.'],
                ['question' => 'Teknologi apa yang didukung?', 'answer' => 'AI kami menghasilkan kode modern yang siap produksi sesuai output yang dipilih — React, TypeScript, dan Tailwind CSS untuk situs web, ditambah tema CMS dan toko yang dapat diinstal. Semuanya mengikuti praktik terbaik dan sepenuhnya dapat dikustomisasi.'],
                ['question' => 'Apakah ada paket gratis?', 'answer' => 'Ya, kami menawarkan paket gratis dengan kredit terbatas untuk mencoba platform.'],
            ],
            'pt' => [
                ['question' => 'Como a IA constrói sites?', 'answer' => 'Nossa IA analisa sua descrição e gera código limpo e pronto para produção com design responsivo.'],
                ['question' => 'Posso exportar meu código?', 'answer' => 'Sim! Você pode exportar seu projeto completo como arquivo ZIP e implantá-lo em qualquer lugar.'],
                ['question' => 'Quais tecnologias são suportadas?', 'answer' => 'Nossa IA gera código moderno e pronto para produção, adaptado à saída escolhida — React, TypeScript e Tailwind CSS para sites, mais temas de CMS e lojas instaláveis. Tudo segue as melhores práticas e permanece totalmente personalizável.'],
                ['question' => 'Existe um plano gratuito?', 'answer' => 'Sim, oferecemos um plano gratuito com créditos limitados para você experimentar a plataforma.'],
            ],
            'es' => [
                ['question' => '¿Cómo construye la IA los sitios web?', 'answer' => 'Nuestra IA analiza tu descripción y genera código limpio y listo para producción con diseño responsive.'],
                ['question' => '¿Puedo exportar mi código?', 'answer' => '¡Sí! Puedes exportar tu proyecto completo como archivo ZIP y desplegarlo en cualquier lugar.'],
                ['question' => '¿Qué tecnologías son compatibles?', 'answer' => 'Nuestra IA genera código moderno y listo para producción adaptado a la salida elegida — React, TypeScript y Tailwind CSS para sitios web, más temas de CMS y tiendas instalables. Todo sigue las mejores prácticas y es totalmente personalizable.'],
                ['question' => '¿Hay un plan gratuito?', 'answer' => 'Sí, ofrecemos un plan gratuito con créditos limitados para que puedas probar la plataforma.'],
            ],
            'ko' => [
                ['question' => 'AI는 어떻게 웹사이트를 구축하나요?', 'answer' => 'AI가 설명을 분석하여 반응형 디자인의 깔끔하고 프로덕션 준비가 된 코드를 생성합니다.'],
                ['question' => '코드를 내보낼 수 있나요?', 'answer' => '네! 전체 프로젝트를 ZIP 파일로 내보내 어디서든 배포할 수 있습니다.'],
                ['question' => '어떤 기술이 지원되나요?', 'answer' => 'AI는 선택한 출력에 맞게 현대적이고 프로덕션 준비가 된 코드를 생성합니다 — 웹사이트용 React, TypeScript, Tailwind CSS와 설치 가능한 CMS 및 스토어 테마를 포함합니다. 모든 것이 모범 사례를 따르며 완전히 커스터마이즈 가능합니다.'],
                ['question' => '무료 플랜이 있나요?', 'answer' => '네, 플랫폼을 체험할 수 있는 제한된 빌드 크레딧이 포함된 무료 플랜을 제공합니다.'],
            ],
            'vi' => [
                ['question' => 'AI xây dựng trang web như thế nào?', 'answer' => 'AI của chúng tôi phân tích mô tả của bạn và tạo mã sạch, sẵn sàng cho sản xuất với thiết kế responsive.'],
                ['question' => 'Tôi có thể xuất mã của mình không?', 'answer' => 'Có! Bạn có thể xuất toàn bộ dự án dưới dạng file ZIP và triển khai ở bất kỳ đâu.'],
                ['question' => 'Những công nghệ nào được hỗ trợ?', 'answer' => 'AI của chúng tôi tạo mã hiện đại, sẵn sàng sản xuất phù hợp với đầu ra bạn chọn — React, TypeScript và Tailwind CSS cho trang web, cộng với các chủ đề CMS và cửa hàng có thể cài đặt. Mọi thứ đều tuân theo các thực tiễn tốt nhất và hoàn toàn có thể tùy chỉnh.'],
                ['question' => 'Có gói miễn phí không?', 'answer' => 'Có, chúng tôi cung cấp gói miễn phí với tín dụng build giới hạn để bạn có thể thử nền tảng.'],
            ],
        ];

        $itemKeys = array_map(fn () => Str::uuid()->toString(), range(0, 3));

        foreach ($faqTranslations as $locale => $faqs) {
            // Additive: only seed items for a locale that has none yet.
            if (LandingItem::where('section_id', $section->id)->where('locale', $locale)->exists()) {
                continue;
            }
            foreach ($faqs as $index => $faq) {
                LandingItem::create([
                    'section_id' => $section->id,
                    'locale' => $locale,
                    'item_key' => $itemKeys[$index],
                    'sort_order' => $index,
                    'is_enabled' => true,
                    'data' => $faq,
                ]);
            }
        }
    }

    protected function seedCtaSection(): void
    {
        $section = LandingSection::where('type', 'cta')->first();

        $translations = [
            'en' => [
                'title' => 'Ready to build something amazing?',
                'subtitle' => 'Start building for free. No credit card required.',
                'button_text' => 'Start Building Today',
                'button_url' => '/register',
            ],
            'ar' => [
                'title' => 'مستعد لبناء شيء مذهل؟',
                'subtitle' => 'ابدأ البناء مجاناً. لا حاجة لبطاقة ائتمان.',
                'button_text' => 'ابدأ البناء اليوم',
                'button_url' => '/register',
            ],
            'de' => [
                'title' => 'Bereit, etwas Erstaunliches zu bauen?',
                'subtitle' => 'Starten Sie kostenlos. Keine Kreditkarte erforderlich.',
                'button_text' => 'Heute starten',
                'button_url' => '/register',
            ],
            'fr' => [
                'title' => 'Prêt à créer quelque chose d\'incroyable ?',
                'subtitle' => 'Commencez gratuitement. Pas de carte de crédit requise.',
                'button_text' => 'Commencer aujourd\'hui',
                'button_url' => '/register',
            ],
            'ja' => [
                'title' => '素晴らしいものを作る準備はできましたか？',
                'subtitle' => '無料で始めましょう。クレジットカードは不要です。',
                'button_text' => '今すぐ始める',
                'button_url' => '/register',
            ],
            'ru' => [
                'title' => 'Готовы создать что-то потрясающее?',
                'subtitle' => 'Начните бесплатно. Кредитная карта не требуется.',
                'button_text' => 'Начать сегодня',
                'button_url' => '/register',
            ],
            'it' => [
                'title' => 'Pronto a costruire qualcosa di straordinario?',
                'subtitle' => 'Inizia a costruire gratuitamente. Nessuna carta di credito richiesta.',
                'button_text' => 'Inizia oggi',
                'button_url' => '/register',
            ],
            'zh' => [
                'title' => '准备好构建令人惊叹的作品了吗？',
                'subtitle' => '免费开始构建。无需信用卡。',
                'button_text' => '立即开始',
                'button_url' => '/register',
            ],
            'id' => [
                'title' => 'Siap membangun sesuatu yang luar biasa?',
                'subtitle' => 'Mulai membangun gratis. Tidak perlu kartu kredit.',
                'button_text' => 'Mulai Hari Ini',
                'button_url' => '/register',
            ],
            'pt' => [
                'title' => 'Pronto para construir algo incrível?',
                'subtitle' => 'Comece a construir gratuitamente. Sem necessidade de cartão de crédito.',
                'button_text' => 'Comece Hoje',
                'button_url' => '/register',
            ],
            'es' => [
                'title' => '¿Listo para construir algo increíble?',
                'subtitle' => 'Empieza a construir gratis. No se requiere tarjeta de crédito.',
                'button_text' => 'Empieza hoy',
                'button_url' => '/register',
            ],
            'ko' => [
                'title' => '놀라운 것을 만들 준비가 되셨나요?',
                'subtitle' => '무료로 시작하세요. 신용카드가 필요 없습니다.',
                'button_text' => '지금 시작하기',
                'button_url' => '/register',
            ],
            'vi' => [
                'title' => 'Sẵn sàng xây dựng điều gì đó tuyệt vời?',
                'subtitle' => 'Bắt đầu xây dựng miễn phí. Không cần thẻ tín dụng.',
                'button_text' => 'Bắt đầu ngay hôm nay',
                'button_url' => '/register',
            ],
        ];

        foreach ($translations as $locale => $content) {
            $this->createContent($section, $locale, $content);
        }
    }

    /**
     * Helper to create content records for a section.
     */
    protected function createContent(LandingSection $section, string $locale, array $fields): void
    {
        foreach ($fields as $field => $value) {
            // firstOrCreate is additive: it fills missing locales/fields but never
            // overwrites content an operator has edited.
            LandingContent::firstOrCreate(
                [
                    'section_id' => $section->id,
                    'locale' => $locale,
                    'field' => $field,
                ],
                ['value' => $value]
            );
        }
    }
}
