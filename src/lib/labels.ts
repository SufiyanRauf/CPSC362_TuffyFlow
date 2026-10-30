import type { SpotKind } from '../types'

// The dashboard and the spots screen were naming these differently, so the same
// place showed as "Food" on one and "eat" on the other.
export const spotKindLabels: Record<SpotKind, string> = {
  study: 'Study spot',
  eat: 'Food',
  meet: 'Meet up',
  charge: 'Charging',
}

// What to call somebody. full_name is whatever signup or Google handed over
// and can be missing, so the email is the next best thing: it is at least
// theirs, and it tells two accounts apart, which "Your account" would not.
export function personName(fullName: string | null, email: string) {
  const named = fullName?.trim()
  if (named) return named
  const local = email.split('@')[0]
  return local || 'Your account'
}

// The same five words api/scoring.py:340 uses when it explains a spot pick on
// the dashboard. A bare "noise 5 of 5" does not tell a student that Panda
// Express is no place to write an essay, and the words were already written,
// they just never reached the screen.
export const noiseWords: Record<number, string> = {
  1: 'silent',
  2: 'quiet',
  3: 'some background noise',
  4: 'lively',
  5: 'loud',
}

export function noiseText(level: number) {
  const word = noiseWords[level]
  return word ? `noise ${level} of 5, ${word}` : `noise ${level} of 5`
}

// Tags are stored as slugs because that is the form the profile is matched
// against, but nobody writes "health-wellness", so the hyphen comes out on the
// way to the screen and nowhere else. Clubs and Events render the same
// vocabulary and were spelling it two different ways.
export function tagText(tag: string) {
  return tag.replace(/-/g, ' ')
}

// Words a student actually types, mapped to the tag the data actually uses.
//
// Interests are matched by exact string against the tags on clubs and events,
// and that vocabulary is small and not shown to anybody. So someone typing
// "machine learning" or "entrepreneurship" or "cybersec" got a green "added"
// and then matched nothing, for the rest of the term. This is the cheap half
// of the fix: it does not invent tags, it just lets a few obvious spellings
// reach the ones that exist.
//
// Every value here is a real tag. The 33 in use are: ai, algorithms, arts,
// business, career, ctf, cultural, cybersecurity, dance, data-science,
// engineering, faith, game-dev, greek-life, health-wellness, leadership,
// lgbtq, mentorship, music, networking, outdoors, political-social-action,
// programming, python, recreation, robotics, service, social,
// software-engineering, sport, startups, sustainability, technology.
const tagAliases: Record<string, string> = {
  'machine-learning': 'ai', 'ml': 'ai', 'artificial-intelligence': 'ai',
  'deep-learning': 'ai', 'neural-networks': 'ai',

  'coding': 'programming', 'code': 'programming', 'leetcode': 'algorithms',
  'competitive-programming': 'algorithms', 'algorithm': 'algorithms',

  'software': 'software-engineering', 'software-development': 'software-engineering',
  'swe': 'software-engineering', 'computer-science': 'software-engineering',
  'cs': 'software-engineering',

  'entrepreneurship': 'startups', 'entrepreneur': 'startups', 'startup': 'startups',
  'founder': 'startups',

  'cyber': 'cybersecurity', 'cybersec': 'cybersecurity', 'infosec': 'cybersecurity',
  'security': 'cybersecurity', 'capture-the-flag': 'ctf',

  'data': 'data-science', 'analytics': 'data-science', 'data-analytics': 'data-science',
  'statistics': 'data-science', 'big-data': 'data-science',

  'gamedev': 'game-dev', 'game-development': 'game-dev', 'games': 'game-dev',
  'robot': 'robotics',

  'volunteering': 'service', 'volunteer': 'service', 'community-service': 'service',
  'charity': 'service',

  'fitness': 'health-wellness', 'wellness': 'health-wellness', 'health': 'health-wellness',
  'mental-health': 'health-wellness',

  'sports': 'sport', 'athletics': 'sport', 'intramural': 'sport',

  'greek': 'greek-life', 'fraternity': 'greek-life', 'sorority': 'greek-life',
  'lgbt': 'lgbtq', 'queer': 'lgbtq', 'pride': 'lgbtq',

  'environment': 'sustainability', 'environmental': 'sustainability',
  'climate': 'sustainability',

  'politics': 'political-social-action', 'activism': 'political-social-action',
  'advocacy': 'political-social-action', 'social-justice': 'political-social-action',

  'career-development': 'career', 'professional-development': 'career',
  'jobs': 'career', 'internship': 'career', 'internships': 'career',

  'mentoring': 'mentorship', 'tutoring': 'mentorship', 'peer-support': 'mentorship',
  'culture': 'cultural', 'heritage': 'cultural',
  'tech': 'technology',
  'religion': 'faith', 'religious': 'faith', 'spiritual': 'faith',
  'finance': 'business', 'marketing': 'business', 'accounting': 'business',
  'art': 'arts', 'design': 'arts', 'theater': 'arts', 'theatre': 'arts', 'film': 'arts',
  'singing': 'music', 'choir': 'music', 'band': 'music',
  'hiking': 'outdoors', 'camping': 'outdoors', 'outdoor': 'outdoors',
  'dancing': 'dance',
}

export function canonicalTag(slug: string) {
  return tagAliases[slug] ?? slug
}
