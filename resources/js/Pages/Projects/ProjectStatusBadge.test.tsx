import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectStatusBadge } from './ProjectStatusBadge';

describe('ProjectStatusBadge', () => {
    it('renders a Building badge for building status', () => {
        render(<ProjectStatusBadge status="building" />);
        expect(screen.getByText('Building')).toBeInTheDocument();
    });

    it('renders a Failed badge for failed status', () => {
        render(<ProjectStatusBadge status="failed" />);
        expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders nothing for idle status', () => {
        const { container } = render(<ProjectStatusBadge status="idle" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing for completed status', () => {
        const { container } = render(<ProjectStatusBadge status="completed" />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing for undefined status', () => {
        const { container } = render(<ProjectStatusBadge status={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing in trash even when building', () => {
        const { container } = render(<ProjectStatusBadge status="building" isTrash />);
        expect(container).toBeEmptyDOMElement();
    });
});
