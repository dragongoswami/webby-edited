import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable, type Column } from '../DataTable';

type Row = { id: number; name: string };

const makeRows = (count: number): Row[] =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

describe('DataTable', () => {
    it('renders column headers and every row when data fits on one page (default cell = item[key])', () => {
        const rows: Row[] = [
            { id: 1, name: 'Alpha' },
            { id: 2, name: 'Beta' },
        ];
        const columns: Column<Row>[] = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' },
        ];

        render(<DataTable columns={columns} data={rows} />);

        expect(screen.getByText('ID')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        // Default cell rendering falls back to item[column.key].
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('uses the custom render(item) function instead of the default cell when provided', () => {
        const rows: Row[] = [
            { id: 1, name: 'Alpha' },
            { id: 2, name: 'Beta' },
        ];
        const renderName = vi.fn((item: Row) => `Custom:${item.name}`);
        const columns: Column<Row>[] = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name', render: renderName },
        ];

        render(<DataTable columns={columns} data={rows} />);

        expect(screen.getByText('Custom:Alpha')).toBeInTheDocument();
        expect(screen.getByText('Custom:Beta')).toBeInTheDocument();
        expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
        expect(renderName).toHaveBeenCalledTimes(2);
        expect(renderName).toHaveBeenCalledWith(rows[0]);
        expect(renderName).toHaveBeenCalledWith(rows[1]);
    });

    it('shows a single "No results found." row spanning all columns when data is empty', () => {
        const columns: Column<Row>[] = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' },
        ];

        const { container } = render(<DataTable columns={columns} data={[]} />);

        const message = screen.getByText('No results found.');
        expect(message).toBeInTheDocument();
        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
        const cell = message.closest('td');
        expect(cell).toHaveAttribute('colspan', String(columns.length));
    });

    it('hides the search input when showSearch is false', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(3)} showSearch={false} />);

        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('uses the default search placeholder unless a custom one is supplied', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        const { rerender } = render(<DataTable columns={columns} data={makeRows(3)} />);
        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();

        rerender(
            <DataTable columns={columns} data={makeRows(3)} searchPlaceholder="Find an item..." />
        );
        expect(screen.getByPlaceholderText('Find an item...')).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('filters case-insensitively across string values, but NOT via a matching number-only value (type guard)', () => {
        const rows: Row[] = [
            { id: 1, name: 'Apple' },
            { id: 2, name: 'BANANA' },
            { id: 42, name: 'Cherry' },
        ];
        const columns: Column<Row>[] = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' },
        ];

        render(<DataTable columns={columns} data={rows} />);
        const input = screen.getByPlaceholderText('Search...');

        // Case-insensitive match against the string `name` value.
        fireEvent.change(input, { target: { value: 'banana' } });
        expect(screen.getByText('BANANA')).toBeInTheDocument();
        expect(screen.queryByText('Apple')).not.toBeInTheDocument();
        expect(screen.queryByText('Cherry')).not.toBeInTheDocument();

        // The `id` column is a number, so the filter's `typeof value === 'string'`
        // guard excludes it entirely -- searching "42" (which only matches the
        // NUMBER id of the Cherry row, not its name) yields no results, even
        // though a row with that exact id value exists.
        fireEvent.change(input, { target: { value: '42' } });
        expect(screen.getByText('No results found.')).toBeInTheDocument();
        expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
    });

    it('resets to page 1 when a search query is entered while on a later page', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(15)} />);

        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

        // Matches all 15 rows, still 2 pages worth -- but the page index must reset.
        const input = screen.getByPlaceholderText('Search...');
        fireEvent.change(input, { target: { value: 'Item' } });
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('paginates with the default page size, slicing rows correctly and disabling Prev/Next at the bounds', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(25)} />);

        // Page 1 of 3: items 1-10.
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 10')).toBeInTheDocument();
        expect(screen.queryByText('Item 11')).not.toBeInTheDocument();
        expect(screen.getByText('Previous')).toBeDisabled();
        expect(screen.getByText('Next')).not.toBeDisabled();

        fireEvent.click(screen.getByText('Next'));
        // Page 2 of 3: items 11-20.
        expect(screen.getByText('Item 11')).toBeInTheDocument();
        expect(screen.getByText('Item 20')).toBeInTheDocument();
        expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Item 21')).not.toBeInTheDocument();
        expect(screen.getByText('Previous')).not.toBeDisabled();
        expect(screen.getByText('Next')).not.toBeDisabled();

        fireEvent.click(screen.getByText('Next'));
        // Page 3 of 3: items 21-25 (partial page).
        expect(screen.getByText('Item 21')).toBeInTheDocument();
        expect(screen.getByText('Item 25')).toBeInTheDocument();
        expect(screen.queryByText('Item 20')).not.toBeInTheDocument();
        expect(screen.getByText('Next')).toBeDisabled();
        expect(screen.getByText('Previous')).not.toBeDisabled();

        fireEvent.click(screen.getByText('Previous'));
        expect(screen.getByText('Item 11')).toBeInTheDocument();
        expect(screen.queryByText('Item 21')).not.toBeInTheDocument();
    });

    it('honors a custom pageSize prop', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(12)} pageSize={5} />);

        expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 5')).toBeInTheDocument();
        expect(screen.queryByText('Item 6')).not.toBeInTheDocument();
    });

    it('hides the pagination bar entirely when totalPages <= 1', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(5)} />);

        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
        expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });

    it('hides the pagination bar when showPagination is false, even with many rows', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(25)} showPagination={false} />);

        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
        expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
        // showPagination only hides the control bar -- rows are still sliced to
        // the (default) page size, since there is no way to advance pages.
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 10')).toBeInTheDocument();
        expect(screen.queryByText('Item 25')).not.toBeInTheDocument();
    });

    it('pins the "Showing :from to :to of :total results" math for a partial last page', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        render(<DataTable columns={columns} data={makeRows(25)} />);

        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();

        // Page 3: startIndex = 20, from = 21, to = min(30, 25) = 25, total = 25.
        // setup.ts's mockTranslate interpolates :from/:to/:total in place, so the
        // literal rendered text is asserted directly here.
        expect(screen.getByText('Showing 21 to 25 of 25 results')).toBeInTheDocument();
    });

    it('PINNED (latent quirk): a parent-driven shrink of `data` while on a later page leaves currentPage stale, producing an empty "No results found." slice even though rows exist', () => {
        const columns: Column<Row>[] = [{ key: 'name', header: 'Name' }];

        const { rerender } = render(<DataTable columns={columns} data={makeRows(25)} />);

        fireEvent.click(screen.getByText('Next'));
        fireEvent.click(screen.getByText('Next'));
        expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
        expect(screen.getByText('Item 21')).toBeInTheDocument();

        // Parent shrinks `data` to 5 items (e.g. after an external delete/filter).
        // DataTable has no effect that resets `currentPage` when `data` changes, so
        // it stays at 3. totalPages recomputes to 1 (ceil(5/10)), so the pagination
        // bar disappears (totalPages > 1 is false) -- but startIndex is still
        // (3-1)*10 = 20, and slice(20, 30) on a 5-item array is empty. The table
        // therefore shows "No results found." even though 5 rows exist. This is a
        // pinned actual behavior (documented, not fixed) -- note the search path
        // (previous test) resets the page correctly since it's driven by the
        // component's own onChange handler, unlike this parent-driven data swap.
        rerender(<DataTable columns={columns} data={makeRows(5)} />);

        expect(screen.getByText('No results found.')).toBeInTheDocument();
        expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Previous')).not.toBeInTheDocument();
        expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });
});
