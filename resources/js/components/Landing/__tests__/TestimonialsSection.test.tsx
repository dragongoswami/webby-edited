import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestimonialsSection } from '../TestimonialsSection';
import type { TestimonialItem } from '../data';

const emblaApi = {
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    scrollTo: vi.fn(),
    selectedScrollSnap: vi.fn(() => 0),
    scrollSnapList: vi.fn(() => [0, 1, 2]),
    canScrollPrev: vi.fn(() => true),
    canScrollNext: vi.fn(() => true),
    on: vi.fn(),
    off: vi.fn(),
};

const autoplay = { stop: vi.fn(), play: vi.fn(), reset: vi.fn() };

vi.mock('embla-carousel-react', () => ({ default: vi.fn(() => [vi.fn(), emblaApi]) }));
vi.mock('embla-carousel-autoplay', () => ({ default: vi.fn(() => autoplay) }));

describe('TestimonialsSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        emblaApi.selectedScrollSnap.mockReturnValue(0);
        emblaApi.scrollSnapList.mockReturnValue([0, 1, 2]);
        emblaApi.canScrollPrev.mockReturnValue(true);
        emblaApi.canScrollNext.mockReturnValue(true);
    });

    it('renders default title, subtitle and default testimonials', () => {
        render(<TestimonialsSection />);

        expect(screen.getByText('What our users say')).toBeInTheDocument();
        expect(
            screen.getByText('Join thousands of satisfied developers and teams who have transformed their workflow.')
        ).toBeInTheDocument();
        expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    });

    it('content overrides title and subtitle', () => {
        render(<TestimonialsSection content={{ title: 'Loved by teams', subtitle: 'Custom sub' }} />);

        expect(screen.getByText('Loved by teams')).toBeInTheDocument();
        expect(screen.getByText('Custom sub')).toBeInTheDocument();
        expect(screen.queryByText('What our users say')).not.toBeInTheDocument();
    });

    it('renders provided testimonials instead of defaults', () => {
        const items: TestimonialItem[] = [
            { quote: 'Amazing tool', author: 'Jane Roe', role: 'CTO', rating: 5 },
        ];
        render(<TestimonialsSection items={items} />);

        expect(screen.getByText(/Amazing tool/)).toBeInTheDocument();
        expect(screen.getByText('Jane Roe')).toBeInTheDocument();
        expect(screen.queryByText('Sarah Chen')).not.toBeInTheDocument();
    });

    it('star rating fills the correct number of stars', () => {
        const items: TestimonialItem[] = [{ quote: 'q', author: 'A B', role: 'r', rating: 3 }];
        const { container } = render(<TestimonialsSection items={items} />);

        expect(container.querySelectorAll('.fill-yellow-400').length).toBe(3);
        expect(container.querySelectorAll('.fill-muted').length).toBe(2);
    });

    it('omits the star rating when rating is absent', () => {
        const items: TestimonialItem[] = [{ quote: 'q', author: 'A', role: 'r', rating: 0 }];
        const { container } = render(<TestimonialsSection items={items} />);

        expect(container.querySelectorAll('.fill-yellow-400').length).toBe(0);
    });

    it('renders the role as a link when company_url is set', () => {
        const items: TestimonialItem[] = [
            { quote: 'q', author: 'A', role: 'CEO', rating: 0, company_url: 'https://acme.test' },
        ];
        render(<TestimonialsSection items={items} />);

        const link = screen.getByRole('link', { name: 'CEO' });
        expect(link).toHaveAttribute('href', 'https://acme.test');
    });

    it('does not render the role as a link when company_url is absent', () => {
        const items: TestimonialItem[] = [{ quote: 'q', author: 'A', role: 'CEO', rating: 0 }];
        render(<TestimonialsSection items={items} />);

        expect(screen.queryByRole('link', { name: 'CEO' })).not.toBeInTheDocument();
        expect(screen.getByText('CEO')).toBeInTheDocument();
    });

    it('shows nav buttons and calls embla api on click', () => {
        render(<TestimonialsSection />);

        const nextButton = screen.getByRole('button', { name: 'Next' });
        const prevButton = screen.getByRole('button', { name: 'Previous' });

        fireEvent.click(nextButton);
        expect(emblaApi.scrollNext).toHaveBeenCalledTimes(1);
        expect(autoplay.stop).toHaveBeenCalledTimes(1);

        fireEvent.click(prevButton);
        expect(emblaApi.scrollPrev).toHaveBeenCalledTimes(1);
    });

    it('renders dot indicators and scrolls on dot click', () => {
        render(<TestimonialsSection />);

        const dots = screen.getAllByRole('tab');
        expect(dots).toHaveLength(3);
        expect(dots[0]).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(dots[1]);
        expect(emblaApi.scrollTo).toHaveBeenCalledWith(1);
    });

    it('hides nav buttons and dots when scrolling is not possible', () => {
        emblaApi.canScrollPrev.mockReturnValue(false);
        emblaApi.canScrollNext.mockReturnValue(false);

        render(<TestimonialsSection />);

        expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
        expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });

    it('getInitials via avatar fallback', () => {
        const items: TestimonialItem[] = [{ quote: 'q', author: 'John Doe', role: 'r', rating: 0 }];
        render(<TestimonialsSection items={items} />);

        expect(screen.getByText('JD')).toBeInTheDocument();
    });
});
