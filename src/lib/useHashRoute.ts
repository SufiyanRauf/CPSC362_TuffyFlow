import { useEffect, useState } from 'react'
import type { View } from '../types'

const VIEWS: View[] = ['home', 'parking', 'spots', 'clubs', 'events', 'profile']

// A hash that is not one of the views, typed or pasted, should leave the screen
// where it is rather than bouncing back to the dashboard.
function readHash(current: View): View {
  const name = window.location.hash.replace(/^#\/?/, '')
  if ((VIEWS as string[]).includes(name)) return name as View
  return name ? current : 'home'
}

// A router without a router. The hash keeps Back working and makes each screen
// linkable, which is the whole reason this exists; anything more would be a
// dependency for six pages.
export function useHashRoute(): [View, (next: View) => void] {
  const [view, setView] = useState<View>(() => readHash('home'))

  useEffect(() => {
    const onChange = () => {
      setView((current) => {
        const next = readHash(current)
        // Done here rather than in an effect on `view`: an unknown hash resolves
        // to the view already showing, so `view` never changes and an effect
        // watching it would never run. replaceState does not fire hashchange,
        // so this cannot loop.
        if (window.location.hash !== `#/${next}`) {
          window.history.replaceState(null, '', `#/${next}`)
        }
        return next
      })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // landing on the bare URL should still show a hash, so Back from a screen
  // returns here rather than leaving the site
  useEffect(() => {
    if (window.location.hash !== `#/${view}`) {
      window.history.replaceState(null, '', `#/${view}`)
    }
  }, [view])

  function go(next: View) {
    window.location.hash = `/${next}`
    window.scrollTo(0, 0)
    // Every button inside the content area unmounts itself by navigating:
    // "Set your permit", "Add your classes", "Full week", "All events", a
    // card's "All lots". Tabbed to one of those and pressed it, and focus
    // landed back on the body, so the next Tab started over at "Skip to
    // content" and I had to walk the whole nav again to get into the screen I
    // had just asked for. The target already exists for the skip link, and
    // App.tsx hands focus to it on sign in for this same reason.
    //
    // The sidebar buttons do survive a nav, so this takes focus off one of
    // them too. That is the better of the two: the next Tab then goes into the
    // new screen rather than further down a nav the student is done with.
    document.getElementById('content')?.focus()
  }

  return [view, go]
}
