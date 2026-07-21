import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialProof } from '../SocialProof';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself) — no re-mock needed here.

describe('SocialProof', () => {
    it('floors counts below 100 to 100+', () => {
        render(<SocialProof statistics={{ projectsCount: 5, usersCount: 0 }} />);

        expect(screen.getAllByText('100+')).toHaveLength(2);
    });

    it('formats hundreds with a trailing plus', () => {
        render(<SocialProof statistics={{ projectsCount: 250, usersCount: 999 }} />);

        expect(screen.getByText('250+')).toBeInTheDocument();
        expect(screen.getByText('999+')).toBeInTheDocument();
    });

    it('formats thousands as K+ and strips a trailing .0', () => {
        render(<SocialProof statistics={{ projectsCount: 1500, usersCount: 5000 }} />);

        expect(screen.getByText('1.5K+')).toBeInTheDocument();
        expect(screen.getByText('5K+')).toBeInTheDocument();
    });

    it('formats exactly 1000 as 1K+', () => {
        render(<SocialProof statistics={{ projectsCount: 1000, usersCount: 0 }} />);

        expect(screen.getByText('1K+')).toBeInTheDocument();
    });

    it('formats millions as M+ and strips a trailing .0', () => {
        render(<SocialProof statistics={{ projectsCount: 1_500_000, usersCount: 2_000_000 }} />);

        expect(screen.getByText('1.5M+')).toBeInTheDocument();
        expect(screen.getByText('2M+')).toBeInTheDocument();
    });

    it('renders the default stat labels and uptime value', () => {
        render(<SocialProof statistics={{ projectsCount: 500, usersCount: 500 }} />);

        expect(screen.getByText('Happy Users')).toBeInTheDocument();
        expect(screen.getByText('Projects Created')).toBeInTheDocument();
        expect(screen.getByText('Availability')).toBeInTheDocument();
        expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('content overrides the labels and uptime value', () => {
        render(
            <SocialProof
                statistics={{ projectsCount: 500, usersCount: 500 }}
                content={{
                    users_label: 'Members',
                    projects_label: 'Sites Built',
                    uptime_label: 'Uptime',
                    uptime_value: '99.9%',
                }}
            />
        );

        expect(screen.getByText('Members')).toBeInTheDocument();
        expect(screen.getByText('Sites Built')).toBeInTheDocument();
        expect(screen.getByText('Uptime')).toBeInTheDocument();
        expect(screen.getByText('99.9%')).toBeInTheDocument();

        expect(screen.queryByText('Happy Users')).not.toBeInTheDocument();
        expect(screen.queryByText('High')).not.toBeInTheDocument();
    });

    it('renders exactly three stat blocks', () => {
        render(<SocialProof statistics={{ projectsCount: 500, usersCount: 500 }} />);

        expect(screen.getByText('Happy Users')).toBeInTheDocument();
        expect(screen.getByText('Projects Created')).toBeInTheDocument();
        expect(screen.getByText('Availability')).toBeInTheDocument();
        expect(screen.getAllByText('500+')).toHaveLength(2);
    });
});
