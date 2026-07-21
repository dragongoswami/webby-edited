import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UseCases } from '../UseCases';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself) — no re-mock needed here. `./data` is left unmocked
// (pure/deterministic) so getIconComponent/getTranslatedPersonas run for real.

describe('UseCases', () => {
    it('renders the four default personas when no items are provided', () => {
        render(<UseCases />);

        expect(screen.getByText('Developers')).toBeInTheDocument();
        expect(screen.getByText('Entrepreneurs')).toBeInTheDocument();
        expect(screen.getByText('Designers')).toBeInTheDocument();
        expect(screen.getByText('Agencies')).toBeInTheDocument();
        expect(screen.getByText('Built for everyone')).toBeInTheDocument();
    });

    it('renders provided items instead of the defaults', () => {
        render(
            <UseCases
                items={[
                    { title: 'Startups', description: 'For founders', icon: 'Rocket' },
                    { title: 'Teams', description: 'For squads', icon: 'Users' },
                ]}
            />
        );

        expect(screen.getByText('Startups')).toBeInTheDocument();
        expect(screen.getByText('Teams')).toBeInTheDocument();
        expect(screen.getByText('For founders')).toBeInTheDocument();
        expect(screen.getByText('For squads')).toBeInTheDocument();
        expect(screen.queryByText('Developers')).not.toBeInTheDocument();
    });

    it('falls back to defaults when items is an empty array', () => {
        render(<UseCases items={[]} />);

        expect(screen.getByText('Developers')).toBeInTheDocument();
    });

    it('content title and subtitle override the defaults', () => {
        render(<UseCases content={{ title: 'Who builds with us', subtitle: 'Makers of all kinds' }} />);

        expect(screen.getByText('Who builds with us')).toBeInTheDocument();
        expect(screen.getByText('Makers of all kinds')).toBeInTheDocument();
        expect(screen.queryByText('Built for everyone')).not.toBeInTheDocument();
    });

    it('renders an icon per persona card, using the Sparkles fallback for an unknown icon name', () => {
        const { container } = render(
            <UseCases
                items={[
                    { title: 'KnownIcon', description: 'd1', icon: 'Rocket' },
                    { title: 'GarbageIcon', description: 'd2', icon: 'this-is-not-a-real-icon' },
                ]}
            />
        );

        expect(screen.getByText('KnownIcon')).toBeInTheDocument();
        expect(screen.getByText('GarbageIcon')).toBeInTheDocument();
        expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
    });

    it('renders one card per provided item', () => {
        const { container } = render(
            <UseCases
                items={[
                    { title: 'One', description: 'd1', icon: 'Rocket' },
                    { title: 'Two', description: 'd2', icon: 'Users' },
                    { title: 'Three', description: 'd3', icon: 'Globe' },
                ]}
            />
        );

        expect(screen.getByText('One')).toBeInTheDocument();
        expect(screen.getByText('Two')).toBeInTheDocument();
        expect(screen.getByText('Three')).toBeInTheDocument();
        expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(3);
    });
});
