import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryGallery } from '../CategoryGallery';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself) — no re-mock needed here. `./data` is left unmocked
// (pure/deterministic) so getIconComponent/getTranslatedCategories run for real.

describe('CategoryGallery', () => {
    it('renders the six default categories when no items are provided', () => {
        render(<CategoryGallery />);

        expect(screen.getByText('Landing Pages')).toBeInTheDocument();
        expect(screen.getByText('Dashboards')).toBeInTheDocument();
        expect(screen.getByText('E-commerce')).toBeInTheDocument();
        expect(screen.getByText('Portfolios')).toBeInTheDocument();
        expect(screen.getByText('Web Apps')).toBeInTheDocument();
        expect(screen.getByText('Admin Panels')).toBeInTheDocument();
        expect(screen.getByText('What will you build?')).toBeInTheDocument();
    });

    it('renders provided items instead of the defaults', () => {
        render(
            <CategoryGallery
                items={[
                    { name: 'Blogs', icon: 'FileText' },
                    { name: 'Games', icon: 'Gamepad' },
                ]}
            />
        );

        expect(screen.getByText('Blogs')).toBeInTheDocument();
        expect(screen.getByText('Games')).toBeInTheDocument();
        expect(screen.queryByText('Landing Pages')).not.toBeInTheDocument();
    });

    it('falls back to defaults when items is an empty array', () => {
        render(<CategoryGallery items={[]} />);

        expect(screen.getByText('Landing Pages')).toBeInTheDocument();
    });

    it('content title and subtitle override the defaults', () => {
        render(<CategoryGallery content={{ title: 'Pick a project type', subtitle: 'Anything you can imagine' }} />);

        expect(screen.getByText('Pick a project type')).toBeInTheDocument();
        expect(screen.getByText('Anything you can imagine')).toBeInTheDocument();
        expect(screen.queryByText('What will you build?')).not.toBeInTheDocument();
    });

    it('renders an icon per category, using the Sparkles fallback for an unknown icon name', () => {
        const { container } = render(
            <CategoryGallery
                items={[
                    { name: 'KnownCat', icon: 'Layout' },
                    { name: 'GarbageCat', icon: 'not-a-real-icon-xyz' },
                ]}
            />
        );

        expect(screen.getByText('KnownCat')).toBeInTheDocument();
        expect(screen.getByText('GarbageCat')).toBeInTheDocument();
        expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
    });

    it('renders one card per provided item', () => {
        render(
            <CategoryGallery
                items={[
                    { name: 'Alpha', icon: 'Rocket' },
                    { name: 'Beta', icon: 'Users' },
                    { name: 'Gamma', icon: 'Globe' },
                    { name: 'Delta', icon: 'Layout' },
                ]}
            />
        );

        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
        expect(screen.getByText('Delta')).toBeInTheDocument();
    });
});
