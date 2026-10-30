import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { LatLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'

// A map of a handful of places on campus.
//
// Circle markers, not Leaflet's pin. The stock pin is a PNG that the library
// loads by a relative path, which a bundler moves, and the usual fix is to
// import the image files and rebuild the icon by hand. A circle is drawn as
// SVG: nothing to load, nothing to go missing in a build, and the color can
// carry which marker is the recommendation.
//
// It is deliberately not interactive. Every option that would let somebody
// move it is off, and the reasons are in the markup below. It fits itself to
// whatever it is given, so there is nothing a person needs to do to it.

export type MapPoint = {
  id: string
  label: string
  lat: number
  lng: number
  // pick is the top recommendation, here is wherever the student is being
  // measured from, and rest is everything else in the list
  tone: 'pick' | 'here' | 'rest'
}

// Straight out of the palette in index.css. Leaflet draws into SVG attributes
// rather than classes, so these cannot be Tailwind names.
const TONES = {
  pick: { color: '#a33f00', fill: '#ff6800', radius: 10 },
  here: { color: '#00274c', fill: '#00274c', radius: 7 },
  rest: { color: '#00274c', fill: '#a9bdd4', radius: 7 },
}

// MapContainer reads its center and zoom once, on mount, so a map told to show
// the ranked lots would keep the first ranking forever. This moves the view
// instead, which is the supported way to change it after mount.
function Frame({ points }: { points: MapPoint[] }) {
  const map = useMap()
  // Sorted, then joined, so the dependency means "these places" and not "these
  // places in this order". The ranking reorders on its own as the hour moves,
  // and without the sort each reorder refits the map to bounds it is already
  // showing, which is work for nothing.
  const key = points.map((p) => `${p.lat},${p.lng}`).sort().join('|')

  useEffect(() => {
    const bounds = new LatLngBounds(points.map((p) => [p.lat, p.lng]))
    // maxZoom matters for one point, where the bounds have no size at all and
    // Leaflet would otherwise zoom to the limit and show four gray tiles
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])

  return null
}

export default function CampusMap({ points, caption }: { points: MapPoint[]; caption: string }) {
  if (points.length === 0) return null

  return (
    <figure className="overflow-hidden rounded-xl border border-rule">
      {/* Hidden from screen readers, because everything on it is in the list
          on the same screen in words, and a set of SVG circles with no names
          is worse than nothing. That only works if there is nothing in here to
          land on, which took all three of the options below: Leaflet adds its
          own zoom buttons by default, and those are real links that stayed
          focusable inside a region marked hidden. A tab stop a screen reader
          refuses to describe is worse than the problem this was avoiding. */}
      <div aria-hidden="true">
        <MapContainer
          // Campus, until Frame fits the markers a moment later. Something has
          // to be here: MapContainer will not mount without a view.
          center={[33.8816, -117.8854]}
          zoom={16}
          // No zoom buttons and no keyboard handler, so nothing in here can
          // take focus. Dragging is off because on a phone it is the drag
          // handler, not the wheel, that eats a scroll: a swipe starting on
          // the map pans the map and the page stays put.
          zoomControl={false}
          keyboard={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          // shift and drag, and a pinch on a phone. Both are on by default and
          // both move the view, which the two above were turned off to prevent.
          boxZoom={false}
          touchZoom={false}
          attributionControl={false}
          className="h-72 w-full sm:h-96"
        >
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          <Frame points={points} />
          {points.map((point) => {
            const tone = TONES[point.tone]
            return (
              <CircleMarker
                key={point.id}
                center={[point.lat, point.lng]}
                radius={tone.radius}
                // weight 3 rather than 2 because the pale blue fill on the
                // non-picks is close enough to the map tiles that from the back
                // of a room the circle stopped being a circle. The navy outline
                // carries the shape instead, and the colors stay as they are.
                pathOptions={{
                  color: tone.color, fillColor: tone.fill, fillOpacity: 0.9, weight: 3,
                }}
              >
                <Tooltip>{point.label}</Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
      {/* Outside the hidden part, so the credit is read as well as seen.
          OpenStreetMap asks for the link, not just the words.
          ink-soft rather than ink-faint: this line is also the key to what the
          marker colors mean, and faint on paper is 4.8:1, which made the one
          thing explaining the graphic the hardest text on the screen to read. */}
      <figcaption className="border-t border-rule bg-paper px-4 py-2 text-xs text-ink-soft">
        {caption} Map data from{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          OpenStreetMap contributors
        </a>
        , under the Open Database License.
      </figcaption>
    </figure>
  )
}
