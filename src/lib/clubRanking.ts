import type { Club } from '../types'

// How the club list gets its order. This lived inside ClubsView as three
// closures over a counts map, which meant the one piece of real algorithm on
// that screen could not be tested: node --test can import a .ts from here but
// not a .tsx component. The component now reads these instead, and the sort it
// does is the comparator below, unchanged.

// Every tag in the list with how many clubs carry it. Counted across the whole
// list rather than the filtered set, because rarity is a property of the club
// list and should not move when a student types in the search box.
export function tagCounts(clubs: Club[]) {
  const counts = new Map<string, number>()
  for (const club of clubs) {
    for (const t of club.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return counts
}

// A club paired with the tags it shares with the student. Not exported: the
// screen builds these inline and nothing outside this file names the type.
type Scored = { club: Club; shared: string[] }

export function clubRanking(clubs: Club[], mine: Set<string>) {
  const counts = tagCounts(clubs)

  // A tag on one club out of 320 is worth 320 times a tag on all of them.
  // counts already covers every club, so this costs nothing extra.
  const weigh = (shared: string[]) =>
    shared.reduce((n, t) => n + 1 / (counts.get(t) ?? 1), 0)

  // Rarest first, so the badge leads with the tag that actually explains why
  // this club is here. Named in tag order it led with "career" on 105 of the
  // 117 cards that matched that profile at all, which is true and tells a
  // student nothing.
  const bySignal = (shared: string[]) =>
    [...shared].sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))

  // Whether any club in the list carries any interest this student has. The
  // tag vocabulary is closed at 29, so a student who typed something outside
  // it, or who has not filled the profile in at all, shares a tag with nothing
  // and the sort below collapses to the alphabet. Two pieces of copy read it:
  // the header, which otherwise promises an order it is not giving, and the
  // empty state, which otherwise blames the filters.
  const canMatch = [...mine].some((t) => counts.has(t))

  // Counting shared tags treats every tag as equally informative, and they
  // are nowhere near it: "career" is on 105 of the 320 clubs and "ai" is on
  // one. Sorting by count put the American Choral Directors Association
  // first and the French Club fourth for a student whose interests are ai,
  // software engineering, data science, music and career, because both of
  // those clubs happened to share the same two common tags, career and
  // music. Career is the one that does the damage: take it off that profile
  // and neither club climbs. Weighting each shared tag by
  // how rare it is puts Data Science and Machine Learning first, which is
  // the answer a person would give. One rare tag outranking three common
  // ones is the point, not a side effect: one "robotics" says far more about
  // a student than three of social, career and service.
  //
  // Name breaks the tie, so two clubs sharing nothing stay in alphabetical
  // order and the list is the same on every render.
  const compare = (a: Scored, b: Scored) =>
    weigh(b.shared) - weigh(a.shared) || a.club.name.localeCompare(b.club.name)

  return { counts, bySignal, canMatch, compare }
}
