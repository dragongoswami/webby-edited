import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StorageStatsCard } from '../StorageStatsCard';
import type { StorageStats, StorageByType, TopStorageUser } from '@/types/admin';

const makeType = (type: string, size_bytes: number): StorageByType => ({
    type,
    size_bytes,
    count: 1,
});

const makeUser = (id: number, name: string, storage_bytes: number): TopStorageUser => ({
    id,
    name,
    email: `${name.toLowerCase()}@example.com`,
    storage_bytes,
});

const baseStats = (overrides: Partial<StorageStats> = {}): StorageStats => ({
    total_storage_bytes: 0,
    total_files: 0,
    projects_with_files: 0,
    storage_by_type: [],
    top_users: [],
    ...overrides,
});

describe('StorageStatsCard', () => {
    it('renders the title and HardDrive icon', () => {
        const { container } = render(<StorageStatsCard stats={baseStats()} />);

        expect(screen.getByText('Storage Usage')).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('formatBytes: 0 bytes renders as "0 B"', () => {
        render(<StorageStatsCard stats={baseStats({ total_storage_bytes: 0 })} />);
        expect(screen.getByText('0 B')).toBeInTheDocument();
    });

    it('formatBytes: 1536 bytes renders as "1.5 KB"', () => {
        render(<StorageStatsCard stats={baseStats({ total_storage_bytes: 1536 })} />);
        expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    });

    it('formatBytes: 1048576 bytes renders as "1 MB"', () => {
        render(<StorageStatsCard stats={baseStats({ total_storage_bytes: 1048576 })} />);
        expect(screen.getByText('1 MB')).toBeInTheDocument();
    });

    it('formatBytes: 1099511627776 bytes renders as "1 TB"', () => {
        render(
            <StorageStatsCard stats={baseStats({ total_storage_bytes: 1099511627776 })} />
        );
        expect(screen.getByText('1 TB')).toBeInTheDocument();
    });

    it('formatBytes trims a trailing ".0": 2048 bytes renders as "2 KB", not "2.0 KB"', () => {
        render(<StorageStatsCard stats={baseStats({ total_storage_bytes: 2048 })} />);
        expect(screen.getByText('2 KB')).toBeInTheDocument();
        expect(screen.queryByText('2.0 KB')).not.toBeInTheDocument();
    });

    it('overview stat grid is responsive (stacks on mobile, 3-col from sm)', () => {
        render(<StorageStatsCard stats={baseStats()} />);

        const grid = screen.getByText('Total Used').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-3');
    });

    it('renders total_files and projects_with_files as given', () => {
        render(
            <StorageStatsCard
                stats={baseStats({ total_files: 42, projects_with_files: 7 })}
            />
        );
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('hides the "By File Type" section entirely when storage_by_type is empty', () => {
        render(<StorageStatsCard stats={baseStats({ storage_by_type: [] })} />);
        expect(screen.queryByText('By File Type')).not.toBeInTheDocument();
    });

    it('renders bar widths (percentage of total) and title attrs for storage_by_type entries', () => {
        const { container } = render(
            <StorageStatsCard
                stats={baseStats({
                    storage_by_type: [makeType('Images', 750), makeType('Videos', 250)],
                })}
            />
        );

        expect(screen.getByText('By File Type')).toBeInTheDocument();

        const imagesBar = container.querySelector('[title="Images: 750 B"]') as HTMLElement;
        const videosBar = container.querySelector('[title="Videos: 250 B"]') as HTMLElement;
        expect(imagesBar).toBeTruthy();
        expect(videosBar).toBeTruthy();
        expect(imagesBar.style.width).toBe('75%');
        expect(videosBar.style.width).toBe('25%');

        // Legend entries.
        expect(screen.getByText('Images: 750 B')).toBeInTheDocument();
        expect(screen.getByText('Videos: 250 B')).toBeInTheDocument();
    });

    it('colorFor maps each known type to its chart var, with an unknown type falling back to --chart-5', () => {
        const { container } = render(
            <StorageStatsCard
                stats={baseStats({
                    storage_by_type: [
                        makeType('Images', 1),
                        makeType('Videos', 1),
                        makeType('Audio', 1),
                        makeType('PDFs', 1),
                        makeType('Other', 1),
                        makeType('Fonts', 1),
                    ],
                })}
            />
        );

        const expectedColors: Record<string, string> = {
            Images: 'var(--chart-1)',
            Videos: 'var(--chart-2)',
            Audio: 'var(--chart-3)',
            PDFs: 'var(--chart-4)',
            Other: 'var(--chart-5)',
            Fonts: 'var(--chart-5)', // unknown type falls back to --chart-5
        };

        Object.entries(expectedColors).forEach(([type, color]) => {
            const bar = container.querySelector(`[title^="${type}:"]`) as HTMLElement;
            expect(bar).toBeTruthy();
            expect(bar.style.backgroundColor).toBe(color);
        });
    });

    it('guards divide-by-zero: when total type storage is 0, all bar widths are "0%"', () => {
        const { container } = render(
            <StorageStatsCard
                stats={baseStats({
                    storage_by_type: [makeType('Images', 0), makeType('Videos', 0)],
                })}
            />
        );

        const imagesBar = container.querySelector('[title="Images: 0 B"]') as HTMLElement;
        const videosBar = container.querySelector('[title="Videos: 0 B"]') as HTMLElement;
        expect(imagesBar.style.width).toBe('0%');
        expect(videosBar.style.width).toBe('0%');
    });

    it('hides the "Top Users by Storage" section entirely when top_users is empty', () => {
        render(<StorageStatsCard stats={baseStats({ top_users: [] })} />);
        expect(screen.queryByText('Top Users by Storage')).not.toBeInTheDocument();
    });

    it('caps top_users to the first 3 (slice), numbered 1./2./3., showing name + formatted size', () => {
        const users = [
            makeUser(1, 'Alice', 5 * 1024 * 1024),
            makeUser(2, 'Bob', 4 * 1024 * 1024),
            makeUser(3, 'Carol', 3 * 1024 * 1024),
            makeUser(4, 'Dave', 2 * 1024 * 1024),
            makeUser(5, 'Eve', 1 * 1024 * 1024),
        ];

        render(<StorageStatsCard stats={baseStats({ top_users: users })} />);

        expect(screen.getByText('Top Users by Storage')).toBeInTheDocument();
        expect(screen.getByText('1.')).toBeInTheDocument();
        expect(screen.getByText('2.')).toBeInTheDocument();
        expect(screen.getByText('3.')).toBeInTheDocument();
        expect(screen.queryByText('4.')).not.toBeInTheDocument();

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
        expect(screen.getByText('Carol')).toBeInTheDocument();
        expect(screen.queryByText('Dave')).not.toBeInTheDocument();
        expect(screen.queryByText('Eve')).not.toBeInTheDocument();

        expect(screen.getByText('5 MB')).toBeInTheDocument();
        expect(screen.getByText('4 MB')).toBeInTheDocument();
        expect(screen.getByText('3 MB')).toBeInTheDocument();
    });

    it('shows "No files uploaded yet" when total_files is 0', () => {
        render(<StorageStatsCard stats={baseStats({ total_files: 0 })} />);
        expect(screen.getByText('No files uploaded yet')).toBeInTheDocument();
    });

    it('hides "No files uploaded yet" when total_files is greater than 0', () => {
        render(<StorageStatsCard stats={baseStats({ total_files: 5 })} />);
        expect(screen.queryByText('No files uploaded yet')).not.toBeInTheDocument();
    });
});
