import { useEffect, useRef } from 'react'

type ConfirmDialogProps = {
  title: string
  // What actually happens if they say yes. Written so somebody can read it and
  // change their mind, which is the only reason a dialog like this exists.
  detail: string
  confirmLabel: string
  // Destructive ones get the warm tint the rest of the app uses for a problem;
  // ordinary ones get the navy. Nothing new, both are already on other buttons.
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// The app's only modal. Everything else gives its answer after the fact, with
// a status line, because almost nothing here is worth interrupting somebody
// for. This is for the two that are: taking a class off the schedule, which
// costs five fields to put back, and leaving, which ends the session.
export default function ConfirmDialog({
  title, detail, confirmLabel, destructive = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus lands on Cancel, not on the action. A dialog that opens with the
  // destructive button focused turns a stray Enter into the thing it was
  // supposed to prevent.
  useEffect(() => { cancelRef.current?.focus() }, [])

  // Escape closes it, and Tab cannot walk out of it into the page behind.
  // Without the trap a keyboard user tabs straight past the dialog onto the
  // controls it is covering, which is worse than having no dialog at all.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCancel(); return }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const stops = panel.querySelectorAll<HTMLElement>('button')
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-titan/40 px-4"
      // A press on the backdrop is a cancel, the same as Escape. On mousedown
      // rather than click, so a drag that starts inside the panel and ends on
      // the backdrop does not close it.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-detail"
        className="w-full max-w-sm rounded-xl border border-rule bg-white p-5 shadow-lg"
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-titan">{title}</h2>
        <p id="confirm-detail" className="mt-1.5 text-sm text-ink-soft">{detail}</p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg border border-rule-strong px-4 text-sm font-medium text-titan
                       hover:border-titan"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              'min-h-11 rounded-lg px-4 text-sm font-medium text-white ' +
              (destructive ? 'bg-flame-ink hover:bg-flame' : 'bg-titan hover:bg-titan-700')
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
