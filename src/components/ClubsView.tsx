import { useState } from 'react'
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

// 320 organizations is more than anyone scrolls through, so the list starts
// capped and opens up on request. It also keeps the first render cheap.
const FIRST_PAGE = 40

async function clubsAndProfile() {
  const [clubs, profile] = await Promise.all([getClubs(), getProfile()])
  return { clubs, profile }
}

export default function ClubsView() {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('any')
  const [onlyMatches, setOnlyMatches] = useState(false)
  const [showAll, setShowAll] = useState(false)
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

  const filtered = query !== '' || tag !== 'any' || onlyMatches

  function reset() {
    setQuery('')
    setTag('any')
    setOnlyMatches(false)
    setShowAll(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clubs">
        {clubs.state === 'ready' && `${clubs.data.length} organizations. `}
        Sorted by how many of your interests and career goals they match.
      </PageHeader>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-rule
                      bg-paper px-4 py-3">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowAll(false) }}
          aria-label="Search clubs"
          placeholder="Search clubs"
          className="min-h-11 w-full rounded-md border border-rule-strong bg-white px-3 py-2 text-sm
                     placeholder:text-ink-faint sm:min-w-48 sm:flex-1"
        />

        <select
          aria-label="Filter by interest"
          value={tag}
          onChange={(e) => { setTag(e.target.value); setShowAll(false) }}
          className="min-h-11 rounded-md border border-rule-strong bg-white px-2.5 py-2 text-sm"
        >
          <option value="any">All interests</option>
          {interests.map(([name, n]) => (
            <option key={name} value={name}>{name} ({n})</option>
          ))}
        </select>

        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
          <input
            className="h-5 w-5"
            type="checkbox"
            checked={onlyMatches}
            onChange={(e) => { setOnlyMatches(e.target.checked); setShowAll(false) }}
          />
          Only ones that match me
        </label>

        {filtered && (
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-titan hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>

      <Panel source={clubs} empty="No clubs loaded.">
        {(all) => {
          // built once per render, not once per club: every keystroke used to
          // compile 320 of these
          const pattern = searchPattern(query)
          const scored = all
            .map((c) => ({ club: c, shared: c.tags.filter((t) => mine.has(t)) }))
            .filter((c) => pattern === null || matches(c.club, pattern))
            .filter((c) => tag === 'any' || c.club.tags.includes(tag))
            .filter((c) => !onlyMatches || c.shared.length > 0)
            .sort((a, b) => b.shared.length - a.shared.length || a.club.name.localeCompare(b.club.name))

          if (scored.length === 0) {
            return (
              <div className="py-6 text-sm text-ink-faint">
                <p role="status">Nothing matches those filters.</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-1 min-h-11 font-medium text-titan hover:underline"
                >
                  Reset filters
                </button>
              </div>
            )
          }

          const visible = showAll ? scored : scored.slice(0, FIRST_PAGE)

          return (
            <div>
              <p role="status" className="mb-2 text-xs text-ink-faint">
                Showing {visible.length} of {scored.length}
                {scored.length !== all.length && ` matching, out of ${all.length}`}
              </p>
              <div className="flex flex-col gap-3">
                {visible.map(({ club, shared }) => (
                  <div key={club.id} className="rounded-xl border border-rule bg-white p-5">
                    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-4">
                      <h2 className="font-semibold text-titan">{club.name}</h2>
                      {shared.length > 0 && (
                        <span className="shrink-0 rounded-md bg-flame/15 px-2 py-0.5 text-xs font-semibold text-flame-ink">
                          matches {shared.join(', ')}
                        </span>
                      )}
                    </div>

                    {club.summary && (
                      <p className="mt-1.5 text-sm text-ink-soft">{club.summary}</p>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {club.tags.map((t) => (
                        <span
                          key={t}
                          className={
                            'rounded-md px-2 py-0.5 text-xs ' +
                            (mine.has(t)
                              ? 'bg-flame/15 font-semibold text-flame-ink'
                              : 'bg-titan-50 text-ink-soft')
                          }
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <p className="mt-2.5 text-xs text-ink-faint">
                      TitanLink categories: {club.categories.join(', ')}
                    </p>

                    {/* a bare 16px link was too small a target, so it is a proper button.
                        Not every club has a page: the column is nullable, and a link
                        built from nothing points at a live 404, which is worse than
                        not offering one. */}
                    {club.website_key && (
                      <a
                        href={TITANLINK + club.website_key}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-md
                                   border border-rule-strong px-2.5 text-xs font-medium text-titan
                                   hover:border-titan"
                      >
                        View on TitanLink
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {!showAll && scored.length > visible.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-3 w-full rounded-xl border border-rule-strong bg-white px-4 py-3 text-sm
                             font-medium text-titan hover:border-titan"
                >
                  Show the other {scored.length - visible.length}
                </button>
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
