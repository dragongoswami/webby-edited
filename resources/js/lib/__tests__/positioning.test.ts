import { describe, it, expect, vi } from 'vitest'
import { clampToViewport } from '../positioning'

describe('clampToViewport', () => {
  it('clamps a negative left to the margin', () => {
    vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 667)
    expect(clampToViewport({ left: -60, top: 50, width: 320, height: 400 }).left).toBe(8)
  })
  it('clamps right overflow to innerWidth - width - margin', () => {
    vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 667)
    expect(clampToViewport({ left: 300, top: 50, width: 320, height: 100 }).left).toBe(375 - 320 - 8)
  })
  it('flips above the anchor when bottom overflows and flipAnchorTop given', () => {
    vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 667)
    const r = clampToViewport({ left: 10, top: 640, width: 128, height: 160, flipAnchorTop: 630 })
    expect(r.top).toBe(630 - 160 - 4)
  })
  it('floors the flipped position at the margin so tall menus near the top stay on-screen', () => {
    vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 300)
    const r = clampToViewport({ left: 10, top: 104, width: 128, height: 200, flipAnchorTop: 100 })
    expect(r.top).toBe(8)
  })
  it('leaves an in-bounds rect untouched', () => {
    vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900)
    expect(clampToViewport({ left: 100, top: 100, width: 320, height: 400 })).toEqual({ left: 100, top: 100 })
  })
})
