import { useEffect, useState } from 'react'

// 80rem is Tailwind's xl, the same breakpoint the right rail's own classes
// used to hide behind.
const WIDE = '(min-width: 80rem)'

// Whether there is room for the right rail.
//
// It used to be CSS alone: the rail rendered everywhere and `hidden xl:block`
// took it off the screen below this width. Display none still mounts the
// component, so every phone and every laptop under 1280px was fetching the
// two panels in it, about 127 documents and a post to the scorer, for
// something nobody could see. Asking here instead means they never mount.
export function useWideScreen() {
  const [wide, setWide] = useState(
    // matchMedia is missing in some test environments, and a server has no
    // window at all. Assuming narrow is the safe way to be wrong: the rail is
    // the extra, not the app.
    () => typeof window !== 'undefined' && window.matchMedia(WIDE).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = window.matchMedia(WIDE)
    const onChange = () => setWide(query.matches)
    onChange()
    query.addEventListener('change', onChange)
    return () => { query.removeEventListener('change', onChange) }
  }, [])

  return wide
}
