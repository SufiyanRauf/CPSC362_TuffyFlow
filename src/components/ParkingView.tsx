import { useAsync } from '../lib/useAsync'
import { getRecommendations } from '../lib/recommend'
import Panel from './Panel'

export default function ParkingView() {
  const recs = useAsync(getRecommendations)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Parking</h1>
        <p className="text-sm text-slate-400">
          Ranked for your next class. Availability is a typical pattern, not a live count.
        </p>
      </div>

      <Panel source={recs} empty="No lots match your permit.">
        {(data) => (
          <div className="flex flex-col gap-2">
            {data.parking.map((lot, i) => (
              <div key={lot.id} className="rounded-xl bg-slate-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{i + 1}</span>
                      <h2 className="font-semibold">{lot.title}</h2>
                    </div>
                    <ul className="mt-1 text-sm text-slate-400">
                      {lot.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-semibold text-amber-400">{lot.match_percent}%</p>
                    {lot.arrive_by ? (
                      <p className="text-xs text-slate-400">arrive by {lot.arrive_by}</p>
                    ) : (
                      <p className="text-xs text-amber-500">leave now</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
