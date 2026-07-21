/**
 * Tests for useInspectorSelection hook.
 * Tests inspector state cleanup when leaving inspect mode.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInspectorSelection } from '../useInspectorSelection';
import type { ElementMention, PendingEdit, InspectorElement } from '@/types/inspector';

const fakeElement: ElementMention = {
    id: 'el-1',
    tagName: 'h1',
    selector: 'h1.text-4xl',
    textPreview: 'Find Your Inner Peace',
};

const fakeInspectorElement: InspectorElement = {
    id: 'el-1',
    tagName: 'h1',
    elementId: null,
    classNames: [],
    textPreview: 'Old',
    xpath: '/html/body/h1',
    cssSelector: 'h1',
    boundingRect: { top: 0, left: 0, width: 100, height: 40 },
    attributes: {},
    parentTagName: 'div',
};

const fakeEdit: PendingEdit = {
    id: 'edit-1',
    element: fakeInspectorElement,
    field: 'text',
    originalValue: 'Old',
    newValue: 'New',
    timestamp: new Date(),
};

describe('useInspectorSelection', () => {
    it('starts with null selectedElement and empty pendingEdits', () => {
        const { result } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: false },
        });
        expect(result.current.selectedElement).toBeNull();
        expect(result.current.pendingEdits).toEqual([]);
    });

    it('retains selectedElement while inspect mode is active', () => {
        const { result } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: true },
        });
        act(() => result.current.setSelectedElement(fakeElement));
        expect(result.current.selectedElement).toEqual(fakeElement);
    });

    it('clears selectedElement when inspect mode deactivates', () => {
        const { result, rerender } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: true },
        });
        act(() => result.current.setSelectedElement(fakeElement));
        expect(result.current.selectedElement).toEqual(fakeElement);

        rerender({ active: false });
        expect(result.current.selectedElement).toBeNull();
    });

    it('clears pendingEdits when inspect mode deactivates', () => {
        const { result, rerender } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: true },
        });
        act(() => result.current.setPendingEdits([fakeEdit]));
        expect(result.current.pendingEdits).toHaveLength(1);

        rerender({ active: false });
        expect(result.current.pendingEdits).toEqual([]);
    });

    it('preserves selectedElement when re-entering inspect mode', () => {
        const { result, rerender } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: false },
        });
        rerender({ active: true });
        act(() => result.current.setSelectedElement(fakeElement));
        expect(result.current.selectedElement).toEqual(fakeElement);
    });

    it('exposes clearSelection that nulls selectedElement', () => {
        const { result } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: true },
        });
        act(() => result.current.setSelectedElement(fakeElement));
        expect(result.current.selectedElement).toEqual(fakeElement);

        act(() => result.current.clearSelection());
        expect(result.current.selectedElement).toBeNull();
    });

    it('clearSelection leaves pendingEdits untouched', () => {
        const { result } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: true },
        });
        act(() => {
            result.current.setSelectedElement(fakeElement);
            result.current.setPendingEdits([fakeEdit]);
        });

        act(() => result.current.clearSelection());
        expect(result.current.selectedElement).toBeNull();
        expect(result.current.pendingEdits).toHaveLength(1);
    });

    it('clearSelection is a stable reference across renders', () => {
        const { result, rerender } = renderHook(({ active }) => useInspectorSelection(active), {
            initialProps: { active: true },
        });
        const first = result.current.clearSelection;
        rerender({ active: true });
        expect(result.current.clearSelection).toBe(first);
    });
});
