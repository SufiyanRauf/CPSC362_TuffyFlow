import { useState } from 'react'
import { useAsync } from '../lib/useAsync'
import { getClubs, getProfile } from '../lib/campusData'
import Panel from './Panel'

export default function ClubsView() {
  const [query, setQuery] = useState('')
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
          Names and categories from TitanLink, retrieved 1 October 2026. Interest tags are ours.
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clubs"
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm placeholder:text-slate-500"
      />

      <Panel source={clubs} empty="No clubs loaded.">
        {(all) => {
          const visible = all
            .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
            .map((c) => ({ club: c, shared: c.tags.filter((t) => mine.has(t)) }))
            .sort((a, b) => b.shared.length - a.shared.length)

          return (
            <>
              <p className="text-xs text-slate-500">
                {visible.length} of {all.length} clubs
              </p>
              <div className="flex flex-col gap-2">
                {visible.map(({ club, shared }) => (
                  <div key={club.id} className="rounded-xl bg-slate-800 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold">{club.name}</h2>
                      {shared.length > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                          matches {shared.length}
                        </span>
                      )}
                    </div>
                    {club.summary && (
                      <p className="mt-1 text-sm text-slate-400">{club.summary}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {club.categories.map((c) => (
                        <span key={c} className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                          {c}
                        </span>
                      ))}
                    </div>
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
