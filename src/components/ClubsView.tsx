import { tagText } from '../lib/labels'
import { useEffect, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getClubs, getProfile } from '../lib/campusData'
import type { Club } from '../types'
import Panel from './Panel'
import PageHeader from './PageHeader'
import { ArrowRightIcon } from './icons'
import { useDataVersion } from '../lib/useDataVersion'

const TITANLINK = 'https://fullerton.campuslabs.com/engage/organization/'

// Searching the name alone misses too much: "robotics" should find Titan Rover,
// which does not have the word in its name, and "ai" should find the machine
// learning club. Tags and the summary carry that.
//
// Matching anywhere in the string was too loose once the list grew to 320:
// "ai" came back with 95 of them, mostly off the middle of a word, the faith
// tag being the worst offender. Anchoring to the start of a word brings that
// back to 27 and keeps short queries usable.
//
// The anchor only goes on a query that starts with a word character. There is
// no word boundary between the start of a string and a "(" or an "&", so a
// club looked up by the punctuation in its name matched nothing at all.
function searchPattern(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(/\w/.test(q[0]) ? `\\b${escaped}` : escaped, 'i')
}

function matches(club: Club, pattern: RegExp) {
  return (
    pattern.test(club.name) ||
    (club.summary !== null && pattern.test(club.summary)) ||
    club.tags.some((t) => pattern.test(t)) ||
    club.categories.some((c) => pattern.test(c))
  )
}

// Three numbers in a row, two of them the same, with the word "matching"
// floating between them: "Showing 27 of 27 matching, out of 320" was the line
// a search produced. An unfiltered list only has two numbers worth saying, so
// it only gets two.
// Which rows you are on, not just how many. With pages, "Showing 20 of 320"
// cannot tell page 1 from page 9.
function countLine(first: number, last: number, found: number, total: number) {
  const range = first === last ? `${first}` : `${first} to ${last}`
  return found === total
    ? `Showing ${range} of ${total} clubs`
    : `Showing ${range} of ${found} matches, from ${total} clubs`
}

// The sentence a reader gets, held back until the typing stops. Searching for
// "robotics" changes the count eight times, and a live region that reports
// every one of them talks over the letters being echoed back. Waiting means
// one announcement, of the answer that was actually being waited for.
function useSettled(text: string) {
  const [settled, setSettled] = useState(text)
  useEffect(() => {
    const waiting = setTimeout(() => setSettled(text), 400)
    return () => clearTimeout(waiting)
  }, [text])
  return settled
}

// Up to seven slots: first, an ellipsis, the current page and its neighbours,
// an ellipsis, last. A zero is a gap rather than a page. The window exists
// because 320 clubs at ten a page is 32 pages, and 32 buttons is its own wall.
function pageWindow(current: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out = new Set<number>([1, pages, current])
  for (const n of [current - 1, current + 1]) if (n > 1 && n < pages) out.add(n)
  const sorted = [...out].sort((a, b) => a - b)
  const withGaps: number[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) withGaps.push(0)
    withGaps.push(n)
  })
  return withGaps
}

// What a student can choose to see at once. 20 first, because the ranked top
// of the list is the part worth reading and 20 is about two screens.
const PER_PAGE = [10, 20, 50, 100]

const NOTHING = 'Nothing matches those filters.'

// The one above blames the filters, and there is a way to empty this list with
// every filter set correctly: tick "Only ones that match me" with interests
// that none of the 320 clubs carry, and the match count is zero everywhere.
// A student reading "Nothing matches those filters" then goes and fiddles with
// filters that were never the problem.
const NO_MATCHES =
  'No club shares an interest with your profile, so "Only ones that match me" has nothing to ' +
  'show. Reset the filters, or add interests on your profile.'

async function clubsAndProfile() {
  const [clubs, profile] = await Promise.all([getClubs(), getProfile()])
  return { clubs, profile }
}

export default function ClubsView() {
  const [query, setQuery] = useState('')
  // A list, not one tag. Picking "ai" used to replace "music", so a student
  // who wanted both had to look twice. Several picked at once is an OR: show
  // me the AI clubs or the music clubs. An AND would be close to useless here,
  // because almost no club carries two of the rarer tags at the same time.
  const [tags, setTags] = useState<string[]>([])
  const [onlyMatches, setOnlyMatches] = useState(false)
  // Pages, not a growing list. Revealing more rows onto the end had two
  // problems that pages do not: the page got longer every press, so the
  // scroll back to the bottom got worse each time, and handing focus to the
  // count line threw the viewport to the top of a list that had just grown.
  // A page is a fixed length, it always starts at the top, and it never grows
  // under you.
  const [perPage, setPerPage] = useState(20)
  const [page, setPage] = useState(1)
  // One loader for both, because the order of the list depends on the profile.
  // Fetched separately, the profile landed second, and 320 rows re-sorted
  // under whoever had started reading them. The loader takes the version: it
  // used to take nothing, so it kept whichever fetch it started with for the
  // life of the mount, and a first fetch that failed was never retried.
  const source = useAsync(clubsAndProfile, [useDataVersion()])
  const clubs = source.state === 'ready'
    ? { state: 'ready' as const, data: source.data.clubs }
    : source

  const mine = source.state === 'ready'
    ? new Set([...source.data.profile.interests, ...source.data.profile.career_goals])
    : new Set<string>()

  // the interests the whole list contains, with how many carry each one. It
  // counts across every club rather than the filtered set, so a search and an
  // interest together can still come back empty. The count is there to show
  // which interests are worth picking, not to promise a result.
  const counts = new Map<string, number>()
  if (clubs.state === 'ready') {
    for (const club of clubs.data) {
      for (const t of club.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  const interests = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  // Whether any club in the list carries any interest this student has. The
  // tag vocabulary is closed at 29, so a student who typed something outside
  // it, or who has not filled the profile in at all, shares a tag with nothing
  // and every sort below collapses to the alphabet. counts already covers all
  // 320 clubs, so this is a lookup per interest and nothing more. Two pieces
  // of copy read it: the header, which otherwise promises an order it is not
  // giving, and the empty state, which otherwise blames the filters.
  const canMatch = [...mine].some((t) => counts.has(t))
  // A tag on one club out of 320 is worth 320 times a tag on all of them.
  // counts already covers every club, so this costs nothing extra.
  const weigh = (shared: string[]) =>
    shared.reduce((n, t) => n + 1 / (counts.get(t) ?? 1), 0)
  // Rarest first, so the badge leads with the tag that actually explains why
  // this club is here. Named in tag order it read "matches career" on nearly
  // every card, which is true and tells a student nothing.
  const bySignal = (shared: string[]) =>
    [...shared].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))

  const filtered = query !== '' || tags.length > 0 || onlyMatches

  // The sorting and filtering moved up here out of the panel below, because
  // the status line has to sit outside the panel to survive the list emptying,
  // and it needs the counts. The panel still decides what is drawn.
  const all = clubs.state === 'ready' ? clubs.data : []
  // built once per render, not once per club: every keystroke used to compile
  // 320 of these
  const pattern = searchPattern(query)
  const scored = all
    .map((c) => ({ club: c, shared: c.tags.filter((t) => mine.has(t)) }))
    .filter((c) => pattern === null || matches(c.club, pattern))
    .filter((c) => tags.length === 0 || tags.some((t) => c.club.tags.includes(t)))
    .filter((c) => !onlyMatches || c.shared.length > 0)
    // Counting shared tags treats every tag as equally informative, and they
    // are nowhere near it: "career" is on 105 of the 320 clubs and "ai" is on
    // one. Sorting by count put the American Choral Directors Association
    // first and the French Club fourth for a student whose interests are ai,
    // software engineering, data science and music, because each of those
    // clubs happened to share two common tags. Weighting each shared tag by
    // how rare it is puts Data Science and Machine Learning first, which is
    // the answer a person would give. One rare tag outranking three common
    // ones is the point, not a side effect: one "robotics" says far more about
    // a student than three of social, career and service.
    .sort((a, b) => weigh(b.shared) - weigh(a.shared) || a.club.name.localeCompare(b.club.name))
  const pages = Math.max(1, Math.ceil(scored.length / perPage))
  // Derived rather than corrected in an effect: a search that shrinks the list
  // can leave page on a number that no longer exists, and clamping here means
  // there is never a render showing an empty page.
  const onPage = Math.min(page, pages)
  const firstRow = (onPage - 1) * perPage
  const visible = scored.slice(firstRow, firstRow + perPage)
  const shownLine = countLine(firstRow + 1, firstRow + visible.length, scored.length, all.length)
  // Worked out once and read by both the live region and the panel, so a
  // reader is told the same reason a sighted student is looking at.
  const nothingText = onlyMatches && !canMatch ? NO_MATCHES : NOTHING
  const announced = useSettled(
    all.length === 0 ? '' : scored.length === 0 ? nothingText : shownLine,
  )

  // Every button on this screen takes itself off the page when you press it:
  // the two reset buttons only exist while a filter is on, and the one at the
  // bottom only exists while the list is capped. Focus landed on the body each
  // time, which on the bottom one dropped a keyboard user at the end of a page
  // that had just grown by 280 cards. The count line is always there, so it is
  // somewhere to hand focus back to.
  // A page change puts you at the top of the list, not the top of the document
  // and not halfway down. Handing focus to the sr-only count line did the
  // first, because that line sits above the filters and focusing a zero sized
  // element throws the viewport up to it.
  const listRef = useRef<HTMLUListElement>(null)
  // Skips the first render, so arriving on the screen does not scroll.
  const landed = useRef(false)

  // In an effect rather than in the click handler. Scrolling straight after
  // setPage ran against the list React had not re-rendered yet, so it measured
  // the old rows and left the viewport in the middle of the new page. The
  // effect runs after the DOM has the new rows in it.
  useEffect(() => {
    if (!landed.current) {
      landed.current = true
      return
    }
    const list = listRef.current
    if (!list) return
    list.scrollIntoView({ block: 'start' })
    // preventScroll because focus() scrolls on its own and would undo the line
    // above. The focus itself is still wanted: it puts a keyboard user's next
    // Tab inside the new page rather than back at the filters.
    list.focus({ preventScroll: true })
  }, [onPage])

  function goToPage(next: number) {
    // aria-disabled keeps the arrows focusable, which is the right call for a
    // control that disables itself under the cursor, so the handler has to be
    // the thing that refuses.
    if (next < 1 || next > pages || next === onPage) return
    setPage(next)
  }
  // Reset used to hand focus to that same count line, and it is sr-only, so it
  // has no size and the focus ring has nothing to draw around. A screen reader
  // user was fine; a sighted keyboard user lost the caret entirely and had to
  // tab from the top of the page. The search box is always mounted, visible,
  // and the next thing anybody does after clearing the filters. Nothing is
  // lost at the other end, because the count carries role="status" and
  // announces on its text changing whether or not it holds focus.
  const searchRef = useRef<HTMLInputElement>(null)

  function reset() {
    setQuery('')
    setTags([])
    setOnlyMatches(false)
    setPage(1)
    searchRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Two things were wrong here. The promise was unconditional, so a
          student whose typed interests are outside the 29 tags got "the ones
          that match come first" over a plain alphabetical list led by Able
          Business Association, and that is the student who can least afford to
          be told something false. And 320 was the first thing on the screen,
          repeated by the count line a few rows down, so the header opened on
          its most intimidating number instead of what it is for.

          The second sentence waits for the data, because canMatch is false
          while the clubs are still loading and the no-match copy would show
          for a moment and then be replaced. */}
      <PageHeader title="Clubs">
        Every registered student organization on campus, in one list.{' '}
        {clubs.state === 'ready' && (canMatch
          ? 'The ones that match your interests and career goals come first.'
          : 'None of them line up with the interests on your profile, so the list is in '
            + 'alphabetical order. Search or pick an interest to narrow it down, and adding '
            + 'interests on your profile brings the matching ones to the top.')}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-rule
                      bg-paper px-4 py-3">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          aria-label="Search clubs"
          placeholder="Search clubs"
          className="min-h-11 w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm
                     placeholder:text-ink-faint sm:min-w-48 sm:flex-1"
        />

        {/* Goes straight back to its own label after each pick, because it is
            a way of adding one, not a display of what is on. What is on is the
            chips underneath, where each one can come off on its own. */}
        <select
          aria-label="Add an interest to filter by"
          value=""
          onChange={(e) => {
            const picked = e.target.value
            if (picked) setTags((on) => on.includes(picked) ? on : [...on, picked])
            setPage(1)
          }}
          className="min-h-11 rounded-md border border-rule-strong bg-white px-2.5 py-2 text-sm"
        >
          <option value="">{tags.length > 0 ? 'Add another interest' : 'All interests'}</option>
          {interests
            .filter(([name]) => !tags.includes(name))
            .map(([name, n]) => (
              <option key={name} value={name}>{tagText(name)} ({n})</option>
            ))}
        </select>

        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
          <input
            className="h-5 w-5"
            type="checkbox"
            checked={onlyMatches}
            onChange={(e) => { setOnlyMatches(e.target.checked); setPage(1) }}
          />
          Only ones that match me
        </label>

        {filtered && (
          // underlined always, not on hover. Navy and a bolder weight are the
          // only things telling this apart from the words beside it otherwise,
          // and colour on its own is not a difference everyone can see.
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-titan underline underline-offset-2"
          >
            Reset filters
          </button>
        )}
      </div>

      {tags.length > 0 && (
        // Same chip shape the club cards use, so a picked interest looks like
        // the thing it matches. Each carries its own remove, because taking
        // one off is the common case and Reset filters clears the lot.
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-md bg-flame/15 px-2 py-0.5
                         text-xs font-semibold text-flame-ink"
            >
              {tagText(t)}
              <button
                type="button"
                onClick={() => { setTags((on) => on.filter((x) => x !== t)); setPage(1) }}
                aria-label={`Stop filtering by ${tagText(t)}`}
                className="grid h-6 w-6 place-items-center rounded text-base leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* One region, always on the page, and the only thing on this screen
          that talks. The count used to be the live region itself, so it went
          off the page at the moment it had something worth saying, and the
          empty state put up a brand new region with the words already inside
          it, which is the shape readers skip. */}
      <p role="status" className="sr-only">{announced}</p>

      <Panel source={clubs} empty="No clubs to show. Reload the page and try again.">
        {() => {
          if (scored.length === 0) {
            return (
              <div className="py-6 text-sm text-ink-faint">
                <p>{nothingText}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 min-h-11 font-medium text-titan underline underline-offset-2"
                >
                  Reset filters
                </button>
              </div>
            )
          }

          return (
            <div>
              <p className="mb-2 text-xs text-ink-faint">{shownLine}</p>
              {/* a list, like every other collection in the app. As a stack of
                  divs this was the one screen where a reader was not told how
                  many cards were coming or given a way to step between them,
                  which is the screen that needs it most at 320 clubs. */}
              {/* scroll-mt-20 because the header is sticky at top 0 and 69px
                  tall, so scrolling the list to y=0 on a page change tucked
                  the first club underneath it and the page looked like it had
                  landed halfway down. 80px clears the header with a little
                  room. */}
              <ul ref={listRef} tabIndex={-1} className="flex scroll-mt-20 flex-col gap-3">
                {visible.map(({ club, shared }) => (
                  <li key={club.id} className="rounded-xl border border-rule bg-white px-5 py-4">
                    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
                      <h2 className="font-semibold text-titan">{club.name}</h2>
                      {shared.length > 0 && (
                        <span className="shrink-0 rounded-md bg-flame/15 px-2 py-0.5 text-xs font-semibold text-flame-ink">
                          matches {bySignal(shared).map(tagText).join(', ')}
                        </span>
                      )}
                    </div>

                    {club.summary && (
                      <p className="mt-1.5 line-clamp-3 text-sm text-ink-soft">{club.summary}</p>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {club.tags.filter((t) => !mine.has(t)).map((t) => (
                        <span key={t} className="rounded-md bg-titan-50 px-2 py-0.5 text-xs text-ink-soft">
                          {tagText(t)}
                        </span>
                      ))}
                    </div>

                    {/* a bare 16px link was too small a target, so it is a proper button.
                        Not every club has a page: the column is nullable, and a link
                        built from nothing points at a live 404, which is worse than
                        not offering one.
                        The name carries the club, because forty of these on one
                        screen all called "View on TitanLink" is forty identical
                        entries in a list of links. The visible words stay the
                        start of it so that saying them still works. */}
                    {club.website_key && (
                      <a
                        href={TITANLINK + club.website_key}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${club.name} on TitanLink`}
                        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md
                                   border border-rule-strong px-2.5 text-xs font-medium text-titan
                                   hover:border-titan"
                      >
                        View on TitanLink
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>

              {scored.length > 0 && (
                // Previous, a window of numbers, Next. The window is there
                // because 320 clubs at ten a page is 32 pages, and 32 buttons
                // is its own wall. First and last are always reachable so the
                // ends of the list are never more than one press away.
                //
                // Previous and Next hold the two ends and only the numbers wrap
                // among themselves. Flat in one row the seven slots came to
                // about 447px against 358px of phone, so Next dropped onto a
                // centred second row on its own while Previous stayed up on the
                // first, which reads as a broken layout rather than a pager.
                // Per page lives here too now: it is a page control, and in the
                // filter bar it was a fourth 44px row standing between somebody
                // and the first club.
                <nav
                  aria-label="Club pages and page size"
                  className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
                >
                  {/* The arrows and the numbers go when there is only one
                      page. Per page does not: it is the control that decides
                      how many pages there are, and hiding it on a single page
                      meant somebody who set 100 could never set it back. */}
                  {pages > 1 && (
                  <>
                  <button
                    type="button"
                    onClick={() => goToPage(onPage - 1)}
                    aria-disabled={onPage === 1}
                    className={
                      'min-h-11 rounded-md border px-3 text-sm font-medium ' +
                      (onPage === 1
                        ? 'border-rule text-ink-faint'
                        : 'border-rule-strong text-titan hover:border-titan')
                    }
                  >
                    Previous
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {pageWindow(onPage, pages).map((n, i) =>
                    n === 0 ? (
                      <span key={`gap-${i}`} className="px-1 text-sm text-ink-faint">...</span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        onClick={() => goToPage(n)}
                        aria-label={`Page ${n} of ${pages}`}
                        aria-current={n === onPage ? 'page' : undefined}
                        className={
                          'min-h-11 min-w-11 rounded-md border px-2 text-sm font-medium tabular-nums ' +
                          (n === onPage
                            ? 'border-titan bg-titan text-white'
                            : 'border-rule-strong text-titan hover:border-titan')
                        }
                      >
                        {n}
                      </button>
                    ),
                  )}

                  </div>

                  <button
                    type="button"
                    onClick={() => goToPage(onPage + 1)}
                    aria-disabled={onPage === pages}
                    className={
                      'min-h-11 rounded-md border px-3 text-sm font-medium ' +
                      (onPage === pages
                        ? 'border-rule text-ink-faint'
                        : 'border-rule-strong text-titan hover:border-titan')
                    }
                  >
                    Next
                  </button>
                  </>
                  )}

                  <label className="flex min-h-11 w-full items-center justify-center gap-2 text-sm text-ink-soft">
                    Per page
                    <select
                      value={perPage}
                      onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }}
                      className="min-h-11 rounded-md border border-rule-strong bg-white px-2.5 py-2 text-sm"
                    >
                      {PER_PAGE.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </nav>
              )}
            </div>
          )
        }}
      </Panel>

      <p className="text-xs text-ink-faint">
        Every organization on Student Life and Leadership's registered list of September 22, 2026.
        Names, summaries and categories are TitanLink's, read October 1, 2026. The interest
        tags are our own.
      </p>
    </div>
  )
}
