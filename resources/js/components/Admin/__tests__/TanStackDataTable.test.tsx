import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { TanStackDataTable } from '../TanStackDataTable';

// Radix Select needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

type Row = { id: number; name: string; age: number };

// 12 rows. Names are assigned in reverse-alphabetical order relative to id so that
// ascending/descending sort is visibly distinguishable from insertion order.
const LETTERS = ['L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
const makeRows = (count = 12): Row[] =>
    LETTERS.slice(0, count).map((letter, index) => ({
        id: index + 1,
        name: `Row ${letter}`,
        age: 20 + index,
    }));

const columns: ColumnDef<Row, unknown>[] = [
    {
        accessorKey: 'name',
        header: ({ column }) => (
            <button
                type="button"
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
                Name
            </button>
        ),
    },
    {
        accessorKey: 'age',
        header: 'Age',
        cell: ({ row }) => (
            <span data-testid={`age-${row.original.id}`}>{row.original.age} yrs</span>
        ),
    },
];

const getBodyRows = (container: HTMLElement) =>
    within(container.querySelector('tbody') as HTMLElement).getAllByRole('row');

describe('TanStackDataTable', () => {
    it('filters across every column, case-insensitively, in global mode (no searchColumn)', () => {
        const { container } = render(
            <TanStackDataTable columns={columns} data={makeRows(5)} />
        );

        // Match by the age column's RAW value (24 → row id 5, "Row H") — proves
        // the filter isn't limited to a single column.
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '24' } });
        let rows = getBodyRows(container);
        expect(rows).toHaveLength(1);
        expect(within(rows[0]).getByText('Row H')).toBeInTheDocument();

        // Case-insensitive on string columns.
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'row h' } });
        rows = getBodyRows(container);
        expect(rows).toHaveLength(1);
        expect(within(rows[0]).getByText('Row H')).toBeInTheDocument();
    });

    it('uses the default "Search..." placeholder unless a custom one is supplied', () => {
        render(<TanStackDataTable columns={columns} data={makeRows(3)} />);
        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('hides the whole pagination bar when showPagination is false', () => {
        render(<TanStackDataTable columns={columns} data={makeRows(12)} showPagination={false} />);
        expect(screen.queryByText('Rows per page')).not.toBeInTheDocument();
        expect(screen.queryByText(/row\(s\) total/)).not.toBeInTheDocument();
    });

    it('honors the pageSize prop via initialState (all rows visible with pagination hidden)', () => {
        const { container } = render(
            <TanStackDataTable
                columns={columns}
                data={makeRows(12)}
                showPagination={false}
                pageSize={12}
            />
        );
        expect(getBodyRows(container)).toHaveLength(12);
    });

    it('renders column headers and only the first page of rows', () => {
        const { container } = render(<TanStackDataTable columns={columns} data={makeRows()} />);

        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Age')).toBeInTheDocument();

        // Default client-side page size is 10, so only 10 of the 12 rows render.
        expect(getBodyRows(container)).toHaveLength(10);
        expect(screen.getByText('Row L')).toBeInTheDocument();
        expect(screen.queryByText('Row B')).not.toBeInTheDocument();
        expect(screen.queryByText('Row A')).not.toBeInTheDocument();
    });

    it('shows the empty state message when there is no data', () => {
        const { container } = render(<TanStackDataTable columns={columns} data={[]} />);

        expect(screen.getByText('No results.')).toBeInTheDocument();
        expect(getBodyRows(container)).toHaveLength(1);
    });

    it('filters rows client-side against searchColumn as the user types', () => {
        render(<TanStackDataTable columns={columns} data={makeRows()} searchColumn="name" />);

        const input = screen.getByPlaceholderText('Search...');
        fireEvent.change(input, { target: { value: 'Row A' } });

        expect(screen.getByText('Row A')).toBeInTheDocument();
        expect(screen.queryByText('Row B')).not.toBeInTheDocument();
        expect(screen.queryByText('Row L')).not.toBeInTheDocument();
    });

    it('hides the search input when showSearch is false', () => {
        render(<TanStackDataTable columns={columns} data={makeRows()} showSearch={false} />);

        expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('sorts rows ascending then descending when the sortable header is clicked', () => {
        const { container } = render(<TanStackDataTable columns={columns} data={makeRows()} />);

        const firstRowName = () => within(getBodyRows(container)[0]).getByText(/^Row /).textContent;

        // Unsorted: insertion order -> "Row L" is first.
        expect(firstRowName()).toBe('Row L');

        fireEvent.click(screen.getByText('Name'));
        expect(firstRowName()).toBe('Row A');

        fireEvent.click(screen.getByText('Name'));
        expect(firstRowName()).toBe('Row L');
    });

    it('paginates client-side with next/prev/first/last, disabling buttons at the bounds', () => {
        render(<TanStackDataTable columns={columns} data={makeRows()} />);

        const first = screen.getByRole('button', { name: 'Go to first page' });
        const prev = screen.getByRole('button', { name: 'Go to previous page' });
        const next = screen.getByRole('button', { name: 'Go to next page' });
        const last = screen.getByRole('button', { name: 'Go to last page' });

        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
        expect(first).toBeDisabled();
        expect(prev).toBeDisabled();
        expect(next).not.toBeDisabled();
        expect(last).not.toBeDisabled();

        fireEvent.click(next);
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
        expect(next).toBeDisabled();
        expect(last).toBeDisabled();
        expect(prev).not.toBeDisabled();

        fireEvent.click(prev);
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

        fireEvent.click(last);
        expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

        fireEvent.click(first);
        expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });

    it('shows more rows after picking a larger page size from the Select', async () => {
        const user = userEvent.setup();
        const { container } = render(<TanStackDataTable columns={columns} data={makeRows()} />);

        expect(getBodyRows(container)).toHaveLength(10);

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: '20' }));

        expect(getBodyRows(container)).toHaveLength(12);
        expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    });

    it('reflects server pagination state and calls onPageChange with 0-based indices', () => {
        const onPageChange = vi.fn();
        const serverPagination = {
            pageCount: 5,
            pageIndex: 2,
            pageSize: 10,
            total: 45,
            onPageChange,
        };
        render(
            <TanStackDataTable
                columns={columns}
                data={makeRows(3)}
                serverPagination={serverPagination}
            />
        );

        // pageIndex 2 (0-based) displays as "Page 3 of 5".
        expect(screen.getByText('Page 3 of 5')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(3);

        fireEvent.click(screen.getByRole('button', { name: 'Go to previous page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(1);

        fireEvent.click(screen.getByRole('button', { name: 'Go to first page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(0);

        fireEvent.click(screen.getByRole('button', { name: 'Go to last page' }));
        expect(onPageChange).toHaveBeenLastCalledWith(4);
    });

    it('renders the serverSearch value and forwards input changes to onChange', () => {
        const onSearchChange = vi.fn();
        render(
            <TanStackDataTable
                columns={columns}
                data={makeRows(3)}
                serverPagination={{
                    pageCount: 1,
                    pageIndex: 0,
                    pageSize: 10,
                    total: 3,
                    onPageChange: vi.fn(),
                }}
                serverSearch={{ value: 'existing', onChange: onSearchChange }}
            />
        );

        const input = screen.getByPlaceholderText('Search...') as HTMLInputElement;
        expect(input.value).toBe('existing');

        fireEvent.change(input, { target: { value: 'new term' } });
        expect(onSearchChange).toHaveBeenCalledWith('new term');

        // Client-side filtering must not run in server mode: all 3 rows still render.
        const rows = document.querySelectorAll('tbody tr');
        expect(rows).toHaveLength(3);
    });

    it('renders the custom cell renderer for each row', () => {
        render(<TanStackDataTable columns={columns} data={makeRows(3)} />);

        expect(screen.getByTestId('age-1')).toHaveTextContent('20 yrs');
        expect(screen.getByTestId('age-2')).toHaveTextContent('21 yrs');
        expect(screen.getByTestId('age-3')).toHaveTextContent('22 yrs');
    });

    it('does not slice rows client-side in server mode even when pageSize exceeds row count', () => {
        const { container } = render(
            <TanStackDataTable
                columns={columns}
                data={makeRows(3)}
                serverPagination={{
                    pageCount: 5,
                    pageIndex: 0,
                    pageSize: 10,
                    total: 45,
                    onPageChange: vi.fn(),
                }}
            />
        );

        // Only 3 rows were passed in, all render regardless of pageSize/pageCount.
        expect(getBodyRows(container)).toHaveLength(3);
    });

    it('renders the server-supplied total in the results readout', () => {
        render(
            <TanStackDataTable
                columns={columns}
                data={makeRows(3)}
                serverPagination={{
                    pageCount: 5,
                    pageIndex: 0,
                    pageSize: 10,
                    total: 45,
                    onPageChange: vi.fn(),
                }}
            />
        );

        expect(screen.getByText('45 row(s) total.')).toBeInTheDocument();
    });

    it('renders a mobile-safe pagination footer (flex-col, sm:flex-row) with a truncating row-count and a sm-only "Rows per page" label', () => {
        render(<TanStackDataTable columns={columns} data={makeRows()} />);

        const rowCountBlock = screen.getByText(/row\(s\) total\./).closest('div') as HTMLElement;
        const footerRoot = rowCountBlock.parentElement as HTMLElement;

        expect(footerRoot).toHaveClass('flex-col', 'sm:flex-row', 'sm:items-center', 'sm:justify-between');
        expect(rowCountBlock).toHaveClass('min-w-0', 'truncate');

        const rowsPerPageLabel = screen.getByText('Rows per page');
        expect(rowsPerPageLabel).toHaveClass('hidden', 'sm:inline');
    });

    it('calls onPageSizeChange instead of client pagination when supplied in server mode', async () => {
        const user = userEvent.setup();
        const onPageSizeChange = vi.fn();
        render(
            <TanStackDataTable
                columns={columns}
                data={makeRows(3)}
                serverPagination={{
                    pageCount: 5,
                    pageIndex: 0,
                    pageSize: 10,
                    total: 45,
                    onPageChange: vi.fn(),
                    onPageSizeChange,
                }}
            />
        );

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: '20' }));

        expect(onPageSizeChange).toHaveBeenCalledWith(20);
    });
});
