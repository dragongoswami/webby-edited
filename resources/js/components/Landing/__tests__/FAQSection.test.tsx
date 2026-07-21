import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FAQSection } from '../FAQSection';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (t returns the key itself, with :param interpolation) — no re-mock needed here.

// Radix Collapsible needs these pointer APIs, which jsdom doesn't implement (iter-70 idiom).
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const items = [
    { question: 'Q one', answer: 'A one' },
    { question: 'Q two', answer: 'A two' },
];

describe('FAQSection', () => {
    it('renders provided items with the first open by default', () => {
        render(<FAQSection items={items} />);

        expect(screen.getByText('Q one')).toBeInTheDocument();
        expect(screen.getByText('Q two')).toBeInTheDocument();
        expect(screen.getByText('A one')).toBeInTheDocument();
        expect(screen.queryByText('A two')).not.toBeInTheDocument();
    });

    it('falls back to translated default FAQs when no items are provided', () => {
        render(<FAQSection />);

        // getTranslatedFAQs(t) under the t-mock returns the raw translation keys as questions.
        expect(screen.getByText('How does the AI understand what I want to build?')).toBeInTheDocument();
        expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();
    });

    it('uses content title and subtitle overrides', () => {
        render(<FAQSection content={{ title: 'Custom Title', subtitle: 'Custom Subtitle' }} />);

        expect(screen.getByText('Custom Title')).toBeInTheDocument();
        expect(screen.getByText('Custom Subtitle')).toBeInTheDocument();
        expect(screen.queryByText('Frequently asked questions')).not.toBeInTheDocument();
    });

    it('toggles to a single open item', async () => {
        render(<FAQSection items={items} />);

        // Opening "Q two" should close "Q one" (single-open accordion).
        fireEvent.click(screen.getByText('Q two'));
        await waitFor(() => expect(screen.getByText('A two')).toBeInTheDocument());
        expect(screen.queryByText('A one')).not.toBeInTheDocument();

        // Clicking the open item again should close it.
        fireEvent.click(screen.getByText('Q two'));
        await waitFor(() => expect(screen.queryByText('A two')).not.toBeInTheDocument());
    });
});
