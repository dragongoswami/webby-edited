import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IconPicker } from './IconPicker';

describe('IconPicker', () => {
    it('renders the current icon name', () => {
        render(<IconPicker value="Database" onChange={vi.fn()} />);
        expect(screen.getByText('Database')).toBeInTheDocument();
    });
});
