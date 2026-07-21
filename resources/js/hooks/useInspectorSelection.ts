import { useCallback, useState } from 'react';
import type { ElementMention, PendingEdit } from '@/types/inspector';

export function useInspectorSelection(isInspectMode: boolean) {
    const [selectedElement, setSelectedElement] = useState<ElementMention | null>(null);
    const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
    const [prevInspectMode, setPrevInspectMode] = useState(isInspectMode);

    // Reset inspector state when leaving inspect mode by adjusting state
    // during render — avoids cascading effect renders.
    if (prevInspectMode !== isInspectMode) {
        setPrevInspectMode(isInspectMode);
        if (!isInspectMode) {
            setSelectedElement(null);
            setPendingEdits([]);
        }
    }

    const clearSelection = useCallback(() => {
        setSelectedElement(null);
    }, []);

    return { selectedElement, setSelectedElement, pendingEdits, setPendingEdits, clearSelection };
}
