import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    TableActionMenu,
    TableActionMenuTrigger,
    TableActionMenuContent,
    TableActionMenuItem,
} from '../table-action-menu';

describe('TableActionMenu positioning', () => {
    it('flips the menu above the trigger when it would overflow the bottom of the viewport', () => {
        const originalInnerHeight = window.innerHeight;
        window.innerHeight = 300;

        render(
            <TableActionMenu>
                <TableActionMenuTrigger />
                <TableActionMenuContent>
                    <TableActionMenuItem>Action</TableActionMenuItem>
                </TableActionMenuContent>
            </TableActionMenu>
        );

        const trigger = screen.getByRole('button');
        trigger.getBoundingClientRect = () => ({
            top: 260,
            bottom: 264,
            left: 100,
            right: 132,
            width: 32,
            height: 4,
            x: 100,
            y: 260,
            toJSON: () => {},
        } as DOMRect);

        fireEvent.click(trigger);

        const menu = document.querySelector('[data-table-action-menu-content]') as HTMLElement | null;
        expect(menu).not.toBeNull();
        const top = parseFloat(menu!.style.top);
        expect(top).toBeLessThan(260);

        window.innerHeight = originalInnerHeight;
    });

    it('re-clamps with the REAL menu height after mount (the click-time estimate is replaced)', () => {
        // Discriminating geometry: the click-time estimate (200) says the menu
        // FITS (108 + 200 = 308 ≤ 332), so the click-time clamp is a no-op —
        // only the post-mount layout effect (real height 250) can move the
        // menu. This test FAILS if the effect is removed.
        vi.stubGlobal('innerHeight', 340);
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(250);

        render(
            <TableActionMenu>
                <TableActionMenuTrigger />
                <TableActionMenuContent>
                    <TableActionMenuItem>Action</TableActionMenuItem>
                </TableActionMenuContent>
            </TableActionMenu>
        );

        const trigger = screen.getByRole('button');
        trigger.getBoundingClientRect = () => ({
            top: 100, bottom: 104, left: 100, right: 132,
            width: 32, height: 4, x: 100, y: 100,
            toJSON: () => {},
        } as DOMRect);

        fireEvent.click(trigger);

        const menu = document.querySelector('[data-table-action-menu-content]') as HTMLElement | null;
        expect(menu).not.toBeNull();
        // Real height 250: 108 + 250 = 358 > 332 → the effect (which passes no
        // flipAnchorTop) must clamp to exactly max(8, 340 - 250 - 8) = 82.
        expect(parseFloat(menu!.style.top)).toBe(82);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
});
