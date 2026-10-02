import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getClubs, getProfile } from '../lib/campusData'
import type { Club } from '../types'
import Panel from './Panel'

const TITANLINK = 'https://fullerton.campuslabs.com/engage/organization/'

// Searching the name alone misses too much: "robotics" should find Titan Rover,
// which does not have the word in its name, and "ai" should find the machine
// learning club. Tags and the summary carry that.
function matches(club: Club, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    club.name.toLowerCase().includes(q) ||
    club.summary.toLowerCase().includes(q) ||
    club.tags.some((t) => t.includes(q)) ||
    club.categories.some((c) => c.toLowerCase().includes(q))
  )
}

export default function ClubsView() {
  const [query, setQuery] = useState('')
  const [onlyMatches, setOnlyMatches] = useState(false)
  const clubs = useAsync(getClubs)
  const profile = useAsync(getProfile)

  const mine = profile.state === 'ready'
    ? new Set([...profile.data.interests, ...profile.data.career_goals])
    : new Set<string>()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Clubs</h1>
        <p className="text-sm text-slate-400">
          Names, summaries and categories from TitanLink, retrieved 1 October 2026. Interest
          tags are ours.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clubs"
          className="flex-1 min-w-48 rounded-lg bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={onlyMatches}
            onChange={(e) => setOnlyMatches(e.target.checked)}
          />
          Only ones that match me
        </label>
      </div>

      <Panel source={clubs} empty="No clubs loaded.">
        {(all) => {
          const scored = all
            .map((c) => ({ club: c, shared: c.tags.filter((t) => mine.has(t)) }))
            .filter((c) => matches(c.club, query))
            .filter((c) => !onlyMatches || c.shared.length > 0)
            .sort((a, b) => b.shared.length - a.shared.length || a.club.name.localeCompare(b.club.name))

          if (scored.length === 0) {
            return <p className="text-sm text-slate-400">Nothing matches that search.</p>
          }

          return (
            <>
              <p className="text-xs text-slate-500">
                {scored.length} of {all.length} clubs
              </p>
              <div className="flex flex-col gap-2">
                {scored.map(({ club, shared }) => (
                  <div key={club.id} className="rounded-xl bg-slate-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold">{club.name}</h2>
                      {shared.length > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                          matches {shared.join(', ')}
                        </span>
                      )}
                    </div>

                    {club.summary && (
                      <p className="mt-1 text-sm text-slate-400">{club.summary}</p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {club.tags.map((t) => (
                        <span
                          key={t}
                          className={
                            mine.has(t)
                              ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400'
                              : 'rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300'
                          }
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      TitanLink categories: {club.categories.join(', ')}
                    </p>

                    <a
                      href={TITANLINK + club.website_key}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-sky-400 hover:underline"
                    >
                      View on TitanLink
                    </a>
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </Panel>
    </div>
  )
}
