import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  failed: boolean
}

// This is the one class component in the app, because the two methods below
// are the only way React lets anything catch a render that throws.
//
// Without it the whole tree unmounts and the page goes white with nothing on
// it, which is the failure getSpots already guards against one case of in
// firestoreData.ts: a document missing a field used to die on
// Object.keys(undefined) outside any catch, so the student got a blank screen
// instead of one of this app's sentences. That guard covers the one shape of
// bad data we thought of. This covers everything we did not, including our own
// mistakes, which is where it came from: a hooks error blanked the app while
// the typecheck, the build and every test stayed green.
//
// It sits above App rather than around each view, because a view that throws
// takes the nav and the header down with it anyway, so there is nothing left
// to keep. One sentence and a way back is the whole job.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The component and the line are not on the screen, by the same rule the
    // panels follow: the app is deployed where anybody can open it, so
    // developer detail goes to the console rather than in front of a visitor.
    // It does have to go somewhere though. Catching an error and saying
    // nothing is worse than the blank page was, because then the bug is also
    // invisible to whoever has to fix it.
    console.error('Render failed, the app has been replaced with the recovery screen:', error)
    console.error(info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-paper px-4">
        <div className="max-w-sm rounded-xl border border-rule bg-white px-6 py-7 text-center">
          <h1 className="text-lg font-semibold text-titan">TuffyFlow could not draw this page.</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Something went wrong on our end, not on yours. Reloading usually puts you back on
            the screen you were on.
          </p>
          <button
            type="button"
            // A reload rather than clearing the flag and trying again. The
            // component that threw would be handed the same state and throw
            // the same way, so the button would look broken.
            onClick={() => window.location.reload()}
            className="mt-5 min-h-11 rounded-md bg-titan px-4 text-sm font-medium text-white
                       hover:bg-titan-700"
          >
            Reload the page
          </button>
        </div>
      </main>
    )
  }
}
