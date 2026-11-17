import { useEffect, useId, useRef, useState } from 'react'

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
// for. This is for the three that are: taking a class off the schedule, which
// costs five fields to put back, leaving, which ends the session, and
// deleting the account, which cannot be undone at all.
export default function ConfirmDialog({
  title, detail, confirmLabel, destructive = false,
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  // Generated, not hardcoded: two of these mounted at once would otherwise
  // share ids and a reader would announce the wrong one's title.
  const titleId = useId()
  const detailId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus lands on Cancel, not on the action. A dialog that opens with the
  // destructive button focused turns a stray Enter into the thing it was
  // supposed to prevent.
  //
  // On the way out it goes back to whatever opened the dialog, because letting
  // it fall on the body means the next Tab starts again from the skip link at
  // the top of the page.
  //
  // Unless somebody else has already put focus somewhere, which is the part
  // that took three tries to get right. Removing a class is the case: the x
  // the dialog was opened from is about to go with its row, so reallyRemove
  // puts focus on the day's heading itself, and handing it back to a button
  // that is one render away from leaving the page drops it on the body a
  // moment later. The first attempt at this was a prop saying which dialogs
  // restore focus, which was wrong because it is not a property of the dialog:
  // the same dialog wants the handback when it is cancelled and not when it is
  // confirmed. The second was a flag for which way it was left, which was
  // wrong too, because confirming the account delete leaves its opener right
  // where it was and nothing else moves focus there.
  //
  // So the question is not which dialog or which button. It is whether, by the
  // time this runs, anything has claimed focus. React detaches the panel before
  // this cleanup, so focus that was inside the dialog has fallen to the body
  // and nobody wants it; focus anywhere else was put there on purpose and is
  // left alone.
  // Captured on the way in, before the effect below focuses Cancel, and once
  // per mount rather than once per effect run. Reading it inside the effect
  // worked in a production build and quietly did not in development: React
  // runs an effect, its cleanup, then the effect again, so the second run read
  // the activeElement the first run had just set, which is Cancel. The dialog
  // then had an opener that was part of itself, isConnected was false by the
  // time it mattered, and focus was never handed back at all. A state
  // initialiser runs during the first render, where nothing has moved focus
  // yet, and is kept across the double invoke.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    cancelRef.current?.focus()
    return () => {
      const claimed = document.activeElement !== null
        && document.activeElement !== document.body
      if (!claimed && opener?.isConnected) opener.focus()
    }
  }, [])

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
      // A click on the title or the padding takes focus off the buttons, and
      // from there neither end matched and Tab walked out into the page behind
      // the dialog. Far enough to reach the account menu and press Log out,
      // which opened a second dialog inside the sticky header, so it painted
      // underneath this one's backdrop.
      //
      // The test is whether focus is on one of the stops, not whether the
      // panel contains it. Containment looked equivalent and is not: the panel
      // carries tabIndex -1, so Chrome answers a click on the heading by
      // focusing the panel itself, which the panel does contain, so this
      // guard passed and neither end matched and Shift+Tab walked out
      // backwards. Measured in Chrome, which is where the demo runs. Anything
      // that is not a stop comes back to the first button.
      if (!Array.from(stops).includes(document.activeElement as HTMLElement)) {
        e.preventDefault()
        first.focus()
        return
      }
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
      //
      // preventDefault because mousedown's own default action is to move
      // focus, and it runs after this handler. Without it the cleanup below
      // handed focus back to the opener correctly and the browser then took it
      // away again a fraction of a millisecond later, onto the body, which is
      // the thing all of this exists to avoid. Measured in Chrome: focusin on
      // the opener, then focusout to BODY, every time.
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        onCancel()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="w-full max-w-sm rounded-xl border border-rule bg-white p-5 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold text-titan">{title}</h2>
        <p id={detailId} className="mt-1.5 text-sm text-ink-soft">{detail}</p>

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
