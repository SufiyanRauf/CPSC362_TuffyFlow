// Directions links.
//
// The obvious thing is to put the lot's latitude and longitude in the URL, and
// that is what this used to do. It sends you to the right spot but Google has
// no name for a bare coordinate, so it labels the destination with whatever it
// finds nearest. On a campus where the lots sit shoulder to shoulder that came
// out as the building next door, and once as a baseball field, which reads as
// a broken link even when the pin is correct.
//
// Giving Google a name it already knows fixes the label. Not every lot has one:
// Google has pins for the structures and the two stadium lots, but nothing for
// the E lots, the R lots or the hourly lot, so those six keep the coordinate.
// Checked by hand on maps.google.com, 9 October 2026.
//
// The names below are Google's, which are not always CSUF's. Google still files
// Eastside South under the old title it had before the north one was built.
const GOOGLE_NAMES: Record<string, string> = {
  "Nutwood Parking Structure": "Nutwood Parking Structure",
  "State College Parking Structure": "State College Parking Structure",
  "Eastside North Parking Structure": "Eastside North Parking Structure",
  "Eastside South Parking Structure": "Eastside Parking Structure",
  "S8": "CSUF - Lot S8",
  "S10": "CSUF Lot S10",
}

// Tacked onto the name because a search is a search: "State College Parking
// Structure" on its own is a fair match for State College, Pennsylvania.
const CAMPUS = "California State University Fullerton"

export function directionsUrl(name: string, lat: number, lng: number) {
  const known = GOOGLE_NAMES[name]
  const destination = known ? `${known}, ${CAMPUS}` : `${lat},${lng}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
