import * as React from "react"
import { createPortal } from "react-dom"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/contexts/LanguageContext"
import { clampToViewport } from "@/lib/positioning"

interface TableActionMenuProps {
  children: React.ReactNode
}

interface TableActionMenuTriggerProps {
  className?: string
  children?: React.ReactNode
}

interface TableActionMenuContentProps {
  children: React.ReactNode
  className?: string
  align?: "start" | "end"
}

interface TableActionMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  variant?: "default" | "destructive"
}

interface TableActionMenuLabelProps {
  children: React.ReactNode
  className?: string
}

interface TableActionMenuSeparatorProps {
  className?: string
}

interface Position {
  top: number
  left: number
}

const TableActionMenuContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  position: Position | null
  setPosition: (position: Position | null) => void
  contentRef: React.RefObject<HTMLDivElement | null>
} | null>(null)

function useTableActionMenu() {
  const context = React.useContext(TableActionMenuContext)
  if (!context) {
    throw new Error("TableActionMenu components must be used within a TableActionMenu")
  }
  return context
}

// Custom event for closing all menus
const CLOSE_ALL_MENUS_EVENT = 'tableActionMenuCloseAll'

function TableActionMenu({ children }: TableActionMenuProps) {
  const [open, setOpen] = React.useState(false)
  const [position, setPosition] = React.useState<Position | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const menuId = React.useId()

  // Listen for close-all event from other menus
  React.useEffect(() => {
    const handleCloseAll = (e: CustomEvent<{ exceptId: string }>) => {
      if (e.detail.exceptId !== menuId) {
        setOpen(false)
      }
    }

    document.addEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAll as EventListener)
    return () => {
      document.removeEventListener(CLOSE_ALL_MENUS_EVENT, handleCloseAll as EventListener)
    }
  }, [menuId])

  // Close on click outside, escape, and scroll
  React.useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Close if clicking outside the menu content (trigger clicks are handled by the trigger itself)
      if (!target.closest('[data-table-action-menu-content]') && !target.closest('[data-table-action-menu-trigger]')) {
        setOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    const handleScroll = () => {
      setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  // Wrap setOpen to dispatch close-all event when opening
  const handleSetOpen = React.useCallback((newOpen: boolean) => {
    if (newOpen) {
      // Dispatch event to close all other menus
      document.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT, {
        detail: { exceptId: menuId }
      }))
    }
    setOpen(newOpen)
  }, [menuId])

  return (
    <TableActionMenuContext.Provider value={{ open, setOpen: handleSetOpen, position, setPosition, contentRef }}>
      <div className="relative" data-table-action-menu>
        {children}
      </div>
    </TableActionMenuContext.Provider>
  )
}

function TableActionMenuTrigger({ className, children }: TableActionMenuTriggerProps) {
  const { t, isRtl } = useTranslation()
  const { open, setOpen, setPosition, contentRef } = useTableActionMenu()
  const menuWidth = 128 // min-width of menu

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const button = e.currentTarget
    const rect = button.getBoundingClientRect()

    if (!open) {
      // Calculate position when opening - adjust for RTL
      const computedLeft = isRtl ? rect.left : rect.right - menuWidth
      setPosition(clampToViewport({
        left: computedLeft,
        top: rect.bottom + 4, // 4px gap
        width: menuWidth,
        height: contentRef.current?.offsetHeight ?? 200,
        flipAnchorTop: rect.top,
      }))
    }
    setOpen(!open)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-8 w-8 p-0", className)}
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup="menu"
      data-table-action-menu-trigger
    >
      {children ?? (
        <>
          <span className="sr-only">{t('Open menu')}</span>
          <MoreHorizontal className="h-4 w-4" />
        </>
      )}
    </Button>
  )
}

function TableActionMenuContent({ children, className }: TableActionMenuContentProps) {
  const { open, position, setPosition, contentRef } = useTableActionMenu()

  // The trigger positions the menu with a height ESTIMATE (the content isn't
  // mounted yet when it computes). Once actually in the DOM, re-clamp with
  // the real measured size so long menus can't hang off-screen.
  React.useLayoutEffect(() => {
    if (!open || !position || !contentRef.current) return
    const el = contentRef.current
    const height = el.offsetHeight
    if (!height) return
    const clamped = clampToViewport({
      left: position.left,
      top: position.top,
      width: el.offsetWidth || 128,
      height,
    })
    if (clamped.left !== position.left || clamped.top !== position.top) {
      setPosition(clamped)
    }
    // Re-run only on open; position updates from this effect must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open || !position) return null

  return createPortal(
    <div
      ref={contentRef}
      role="menu"
      data-table-action-menu-content
      className={cn(
        "fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      style={{ top: position.top, left: position.left }}
    >
      {children}
    </div>,
    document.body
  )
}

function TableActionMenuItem({
  children,
  className,
  variant = "default",
  onClick,
  ...props
}: TableActionMenuItemProps) {
  const { setOpen } = useTableActionMenu()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    setOpen(false)
  }

  return (
    <button
      role="menuitem"
      className={cn(
        "relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
        variant === "destructive" && "text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

function TableActionMenuLabel({ children, className }: TableActionMenuLabelProps) {
  return (
    <div className={cn("px-2 py-1.5 text-sm font-medium", className)}>
      {children}
    </div>
  )
}

function TableActionMenuSeparator({ className }: TableActionMenuSeparatorProps) {
  return (
    <div className={cn("bg-border -mx-1 my-1 h-px", className)} role="separator" />
  )
}

export {
  TableActionMenu,
  TableActionMenuTrigger,
  TableActionMenuContent,
  TableActionMenuItem,
  TableActionMenuLabel,
  TableActionMenuSeparator,
}
