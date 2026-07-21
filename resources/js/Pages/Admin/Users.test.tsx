import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { AdminUser, PaginationData } from '@/types/admin';

// Radix Dialog/AlertDialog/Select need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

const routerGet = vi.fn();
const routerPost = vi.fn();
const routerPut = vi.fn();
const routerDelete = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        get: (...args: unknown[]) => routerGet(...args),
        post: (...args: unknown[]) => routerPost(...args),
        put: (...args: unknown[]) => routerPut(...args),
        delete: (...args: unknown[]) => routerDelete(...args),
        // usePageLoading (used internally by Users) subscribes to these.
        on: vi.fn(() => vi.fn()),
    },
    usePage: () => ({ props: { isDemo: false } }),
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// The global `route()` helper is stubbed by the test setup to ignore params
// (`/${name}`), which would hide a bug where the wrong id is passed. Replace
// it here with a spy that embeds the param so we can assert on the real URL.
const routeSpy = vi.fn((name: string, param?: string | number) =>
    param !== undefined ? `/${name}/${param}` : `/${name}`
);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

import Users from './Users';

const currentAdmin = {
    id: 1,
    name: 'Current Admin',
    email: 'admin@example.com',
} as never;

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
    return {
        id: 2,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
        status: 'active',
        projects_count: 3,
        created_at: '2026-01-01T00:00:00Z',
        is_super_admin: false,
        ...overrides,
    };
}

function makePagination(overrides: Partial<PaginationData> = {}): PaginationData {
    return {
        current_page: 1,
        last_page: 1,
        per_page: 10,
        total: 1,
        ...overrides,
    };
}

function renderUsers(usersList: AdminUser[], pagination = makePagination({ total: usersList.length }), filters = { search: '' }) {
    return render(
        <Users
            user={currentAdmin}
            users={{ data: usersList }}
            pagination={pagination}
            filters={filters}
        />
    );
}

describe('Admin/Users', () => {
    beforeEach(() => {
        routerGet.mockClear();
        routerPost.mockClear();
        routerPut.mockClear();
        routerDelete.mockClear();
        routeSpy.mockClear();
    });

    it('renders user rows with name, email, and role badge from the users prop', () => {
        renderUsers([
            makeUser({ id: 2, name: 'Jane Doe', email: 'jane@example.com', role: 'user' }),
            makeUser({ id: 3, name: 'Sam Admin', email: 'sam@example.com', role: 'admin' }),
        ]);

        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        expect(screen.getByText('Sam Admin')).toBeInTheDocument();
        expect(screen.getByText('sam@example.com')).toBeInTheDocument();

        const badges = screen.getAllByText(/^(User|Admin)$/);
        expect(badges.some((b) => b.textContent === 'User')).toBe(true);
        expect(badges.some((b) => b.textContent === 'Admin')).toBe(true);
    });

    it('shows an empty state when there are no users', () => {
        renderUsers([], makePagination({ total: 0 }));

        expect(screen.getByText('No results.')).toBeInTheDocument();
    });

    it('debounces the search input before navigating with the search param', async () => {
        renderUsers([makeUser()]);

        fireEvent.change(screen.getByPlaceholderText('Search users...'), {
            target: { value: 'jane' },
        });

        // Not fired immediately — debounced.
        expect(routerGet).not.toHaveBeenCalled();

        await waitFor(() => {
            expect(routerGet).toHaveBeenCalledTimes(1);
        });

        expect(routeSpy).toHaveBeenCalledWith('admin.users');
        const [url, params] = routerGet.mock.calls[0];
        expect(url).toBe('/admin.users');
        expect(params).toEqual({ search: 'jane', per_page: 10, page: 1 });
    });

    it('Add User dialog: opens, accepts input, and submits to the store route with form data', async () => {
        const user = userEvent.setup();
        renderUsers([makeUser()]);

        fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Add a new user to the system')).toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'New User' } });
        fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'new@example.com' } });
        fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'secret123' } });

        // Change role to Admin via the Radix Select.
        const comboboxes = within(dialog).getAllByRole('combobox');
        await user.click(comboboxes[0]);
        await user.click(await screen.findByRole('option', { name: 'Admin' }));

        fireEvent.click(within(dialog).getByRole('button', { name: 'Create User' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.users.store');
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.users.store');
        expect(data).toEqual({
            name: 'New User',
            email: 'new@example.com',
            password: 'secret123',
            role: 'admin',
            status: 'active',
        });
    });

    it('Add User dialog: role/status grid is responsive (stacks on mobile, 2-col from sm)', () => {
        renderUsers([makeUser()]);

        fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
        const dialog = screen.getByRole('dialog');
        const grid = within(dialog).getByText('Role').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('Edit dialog: role/status grid is responsive (stacks on mobile, 2-col from sm)', () => {
        renderUsers([makeUser({ id: 5 })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
        const dialog = screen.getByRole('dialog');
        const grid = within(dialog).getByText('Role').closest('.grid');

        expect(grid).toHaveClass('grid-cols-1');
        expect(grid).toHaveClass('sm:grid-cols-2');
    });

    it('Add User dialog: blocks submit and shows validation messages when required fields are empty', () => {
        renderUsers([makeUser()]);

        fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
        const dialog = screen.getByRole('dialog');

        fireEvent.click(within(dialog).getByRole('button', { name: 'Create User' }));

        expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
        expect(within(dialog).getByText('Email is required')).toBeInTheDocument();
        expect(within(dialog).getByText('Password is required')).toBeInTheDocument();
        expect(routerPost).not.toHaveBeenCalled();
    });

    it('Edit dialog: pre-fills the selected user and submits without a password key when left blank', () => {
        renderUsers([makeUser({ id: 5, name: 'Edit Me', email: 'edit@example.com', role: 'user', status: 'active' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByLabelText('Name')).toHaveValue('Edit Me');
        expect(within(dialog).getByLabelText('Email')).toHaveValue('edit@example.com');

        fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Edited Name' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.users.update', 5);
        expect(routerPut).toHaveBeenCalledTimes(1);
        const [url, data] = routerPut.mock.calls[0];
        expect(url).toBe('/admin.users.update/5');
        expect(data).toEqual({
            name: 'Edited Name',
            email: 'edit@example.com',
            role: 'user',
            status: 'active',
        });
        expect(data).not.toHaveProperty('password');
    });

    it('Edit dialog: includes the password key when a new password is entered', () => {
        renderUsers([makeUser({ id: 5, name: 'Edit Me', email: 'edit@example.com' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText(/New Password/), { target: { value: 'newpass1' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

        expect(routerPut).toHaveBeenCalledTimes(1);
        const [, data] = routerPut.mock.calls[0];
        expect(data).toMatchObject({ password: 'newpass1' });
    });

    it('Delete: confirming the AlertDialog deletes the user via the destroy route', () => {
        renderUsers([makeUser({ id: 7, name: 'Delete Me' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.users.destroy', 7);
        expect(routerDelete).toHaveBeenCalledTimes(1);
        expect(routerDelete.mock.calls[0][0]).toBe('/admin.users.destroy/7');
    });

    it('Delete: cancelling the AlertDialog does not call the destroy route', () => {
        renderUsers([makeUser({ id: 7, name: 'Delete Me' })]);

        fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(routerDelete).not.toHaveBeenCalled();
    });

    it('Impersonate: posts to the impersonate route, and hides the action for admins and the current user', () => {
        renderUsers([
            makeUser({ id: 9, name: 'Impersonate Me', role: 'user' }),
            makeUser({ id: 1, name: 'Current Admin', role: 'admin' }),
        ]);

        const menuButtons = screen.getAllByRole('button', { name: 'Open menu' });

        fireEvent.click(menuButtons[0]);
        expect(screen.getByRole('menuitem', { name: 'Impersonate' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Impersonate' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.users.impersonate', 9);
        expect(routerPost).toHaveBeenCalledTimes(1);
        expect(routerPost.mock.calls[0][0]).toBe('/admin.users.impersonate/9');

        // The second row is an admin (role !== user gate) — no Impersonate item.
        fireEvent.click(menuButtons[1]);
        expect(screen.queryByRole('menuitem', { name: 'Impersonate' })).not.toBeInTheDocument();
    });

    it('toggling the status switch puts the flipped status to the update route', () => {
        renderUsers([makeUser({ id: 4, name: 'Toggle Me', status: 'active' })]);

        fireEvent.click(screen.getByRole('switch'));

        expect(routeSpy).toHaveBeenCalledWith('admin.users.update', 4);
        expect(routerPut).toHaveBeenCalledTimes(1);
        const [url, data] = routerPut.mock.calls[0];
        expect(url).toBe('/admin.users.update/4');
        expect(data).toEqual({ status: 'inactive' });
    });

    it('server pagination: clicking next page navigates with the incremented page param', () => {
        renderUsers(
            [makeUser()],
            makePagination({ current_page: 1, last_page: 3, per_page: 10, total: 25 }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.users');
        const [, params] = routerGet.mock.calls[0];
        expect(params).toEqual({ search: undefined, per_page: 10, page: 2 });
    });
});
