/**
 * Class-assertion tests for the Task 3 UI primitive batch: dvh dialogs, a
 * 16px (iOS-safe) select trigger on mobile, RTL-safe table cells, a 36px
 * sidebar trigger, and keyboard-operable AppSidebar collapsible section
 * triggers.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DesignSystemPreviewModal } from '@/components/Design/DesignSystemPreviewModal';

// AppSidebar (used only in the last describe block below) renders Inertia
// Links + reads usePage(), and ApplicationLogo needs ThemeContext.
vi.mock('@inertiajs/react', () => ({
    usePage: () => ({
        props: {
            appSettings: {
                referral_enabled: false,
                site_name: 'Webby',
                site_tagline: 'Build with AI',
                site_logo: null,
                site_logo_dark: null,
                color_theme: 'neutral',
            },
            recentProjects: null,
            hasUpgradablePlans: false,
            databaseEnabled: false,
            canUseGithub: false,
            canConnectShopify: false,
            canUseApi: false,
            fileStorageEnabled: false,
        },
        url: '/projects',
    }),
    Link: ({ href, children, ...rest }: { href: string; children?: ReactNode; [key: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ resolvedTheme: 'light', theme: 'light', setTheme: () => {} }),
}));

describe('DialogContent', () => {
    it('uses dvh for its max-height (not vh)', () => {
        render(
            <Dialog open onOpenChange={() => {}}>
                <DialogContent>
                    <DialogTitle>Title</DialogTitle>
                </DialogContent>
            </Dialog>
        );

        const content = document.body.querySelector('[data-slot="dialog-content"]');
        expect(content).not.toBeNull();
        expect(content?.className).toContain('max-h-[calc(100dvh-2rem)]');
        expect(content?.className).not.toContain('100vh');
    });

    it('gives the close button a p-1.5 hit-padding class', () => {
        render(
            <Dialog open onOpenChange={() => {}}>
                <DialogContent>
                    <DialogTitle>Title</DialogTitle>
                </DialogContent>
            </Dialog>
        );

        const closeButton = screen.getByRole('button', { name: 'Close' });
        expect(closeButton.className).toContain('p-1.5');
    });
});

describe('SelectTrigger', () => {
    it('renders a 16px base font size that shrinks to 14px at md (iOS zoom-safe)', () => {
        render(
            <Select>
                <SelectTrigger>
                    <SelectValue placeholder="Pick one" />
                </SelectTrigger>
            </Select>
        );

        const trigger = screen.getByRole('combobox');
        expect(trigger.className).toContain('text-base');
        expect(trigger.className).toContain('md:text-sm');
    });
});

describe('TableHead', () => {
    it('uses logical text-start/pe-0 instead of physical text-left/pr-0', () => {
        const { container } = render(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                    </TableRow>
                </TableHeader>
            </Table>
        );

        const th = container.querySelector('th');
        expect(th?.className).toContain('text-start');
        expect(th?.className).not.toContain('text-left');
        expect(th?.className).toContain('pe-0');
        expect(th?.className).not.toContain('pr-0');
    });
});

describe('SidebarTrigger', () => {
    it('meets the 36px dense-row touch-target floor', () => {
        render(
            <SidebarProvider>
                <SidebarTrigger />
            </SidebarProvider>
        );

        const button = screen.getByRole('button', { name: 'Toggle Sidebar' });
        expect(button.className).toContain('h-9 w-9');
        expect(button.className).not.toContain('h-7 w-7');
    });
});

describe('DesignSystemPreviewModal', () => {
    it('uses a dvh max-height instead of a fixed vh height', () => {
        render(
            <DesignSystemPreviewModal slug="substrate" name="Substrate" open onOpenChange={() => {}} />
        );

        const content = document.body.querySelector('[data-slot="dialog-content"]');
        expect(content).not.toBeNull();
        expect(content?.className).toContain('max-h-[calc(100dvh-2rem)]');
        expect(content?.className).not.toContain('h-[calc(100vh-2rem)]');
        // No fixed (non-max) dvh height class either — height must be able to shrink.
        const classes = content?.className.split(/\s+/) ?? [];
        expect(classes).not.toContain('h-[calc(100dvh-2rem)]');
    });
});

describe('AppSidebar collapsible section triggers', () => {
    it('renders real, keyboard-operable <button type="button"> elements for the section headers', async () => {
        const { AppSidebar } = await import('@/components/Sidebar/AppSidebar');
        const user = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' as const };

        render(
            <SidebarProvider>
                <AppSidebar user={user} />
            </SidebarProvider>
        );

        const projectsTrigger = screen.getByText('Projects').closest('button');
        expect(projectsTrigger).not.toBeNull();
        expect(projectsTrigger?.tagName).toBe('BUTTON');
        expect(projectsTrigger).toHaveAttribute('type', 'button');

        const adminTrigger = screen.getByText('Administration').closest('button');
        expect(adminTrigger).not.toBeNull();
        expect(adminTrigger?.tagName).toBe('BUTTON');
        expect(adminTrigger).toHaveAttribute('type', 'button');
    });
});
