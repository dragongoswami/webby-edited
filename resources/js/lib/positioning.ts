export function clampToViewport(rect: {
  left: number; top: number; width: number; height: number;
  margin?: number; flipAnchorTop?: number;
}): { left: number; top: number } {
  const margin = rect.margin ?? 8
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin))
  let top = rect.top
  if (top + rect.height > window.innerHeight - margin) {
    top = rect.flipAnchorTop !== undefined
      ? Math.max(margin, rect.flipAnchorTop - rect.height - 4)
      : Math.max(margin, window.innerHeight - rect.height - margin)
  }
  return { left, top }
}
