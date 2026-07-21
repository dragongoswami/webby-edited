import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeaturesBento } from './FeaturesBento';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (returns key as translation, no LanguageProvider wrapper needed)
const items = [
    { title: 'Always On', description: 'a', icon: 'Sparkles', size: 'small' as const },
    { title: 'WP Card', description: 'b', icon: 'Newspaper', size: 'medium' as const, plugin_slug: 'wordpress' },
];

describe('FeaturesBento plugin gating', () => {
    it('hides a plugin card when its capability is off', () => {
        render(<FeaturesBento items={items} pluginCapabilities={{ wordpress: false }} />);
        expect(screen.getByText('Always On')).toBeInTheDocument();
        expect(screen.queryByText('WP Card')).not.toBeInTheDocument();
    });

    it('shows a plugin card when its capability is on', () => {
        render(<FeaturesBento items={items} pluginCapabilities={{ wordpress: true }} />);
        expect(screen.getByText('WP Card')).toBeInTheDocument();
    });
});
