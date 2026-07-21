import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrustedBy } from '../TrustedBy';

describe('TrustedBy', () => {
    it('renders the default companies when no items are provided', () => {
        render(<TrustedBy />);

        expect(screen.getByText('Trusted by teams at')).toBeInTheDocument();
        expect(screen.getAllByText('TechFlow')).toHaveLength(3);
        expect(screen.getAllByText('DevStack')).toHaveLength(3);
    });

    it('renders provided items instead of the defaults', () => {
        render(
            <TrustedBy
                items={[
                    { name: 'Acme', initial: 'A', color: 'bg-red-500' },
                    { name: 'Globex', initial: 'G', color: 'bg-teal-500' },
                ]}
            />
        );

        expect(screen.getAllByText('Acme')).toHaveLength(3);
        expect(screen.getAllByText('Globex')).toHaveLength(3);
        expect(screen.queryByText('TechFlow')).not.toBeInTheDocument();
    });

    it('falls back to defaults when items is an empty array', () => {
        render(<TrustedBy items={[]} />);

        expect(screen.getAllByText('TechFlow')).toHaveLength(3);
    });

    it('content title overrides the default', () => {
        render(<TrustedBy content={{ title: 'Backed by industry leaders' }} />);

        expect(screen.getByText('Backed by industry leaders')).toBeInTheDocument();
        expect(screen.queryByText('Trusted by teams at')).not.toBeInTheDocument();
    });

    it('renders an image badge when image_url is set', () => {
        render(
            <TrustedBy
                items={[
                    {
                        name: 'PixelCo',
                        initial: 'P',
                        color: 'bg-blue-500',
                        image_url: 'https://cdn.test/logo.png',
                    },
                ]}
            />
        );

        const images = screen.getAllByAltText('PixelCo');
        expect(images).toHaveLength(3);
        images.forEach((img) => {
            expect(img).toHaveAttribute('src', 'https://cdn.test/logo.png');
        });
        expect(screen.queryByText('PixelCo')).not.toBeInTheDocument();
    });

    it('renders the initial + name fallback when no image_url', () => {
        render(<TrustedBy items={[{ name: 'NoLogo', initial: 'N', color: 'bg-green-500' }]} />);

        expect(screen.getAllByText('NoLogo')).toHaveLength(3);
        expect(screen.getAllByText('N')).toHaveLength(3);
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
