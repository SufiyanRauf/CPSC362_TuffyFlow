// The decisions the profile screen makes before it writes anything.
//
// They were inside ProfileView.tsx, which is the largest file in the project
// and the one with no tests, so the two rules that have to agree with
// db/firestore.rules were the two nobody could check. node --test can import
// a .ts from here but not a .tsx component, which is the same reason
// clubRanking.ts was pulled out of ClubsView.tsx. The component still does
// the talking; these just answer.
//
// tests/profile_edits.test.mjs reads db/firestore.rules and fails if the two
// numbers below stop matching the ones the database enforces, which is what
// "kept in step by hand" used to mean here.
import { canonicalTag } from './labels.ts'

// The most interests, or career goals, one profile may carry. The rules file
// is what actually enforces it; the screen says it first so that a student
// who types a thirteenth reads a sentence instead of a security rules error.
export const MOST_TAGS = 12

// The longest a single tag may be, again from the rules file.
export const LONGEST_TAG = 32

// What gets stored when somebody types an interest. Club and event tags are
// lowercase words joined by hyphens and are compared by exact string, so
// anything else can never match one and is dead weight on the profile.
//
// Returns '' when the draft is nothing but punctuation. That is a real case,
// not a guard: the caller has to report it rather than store an empty tag,
// which the rules would refuse anyway because aTag() wants size() > 0.
export function tagSlug(draft: string): string {
  return draft.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// The slug the student typed, resolved to the word the campus data actually
// uses. Somebody typing "machine learning" used to be told in green that it
// had been added and then matched nothing for the rest of the term.
export function tagFor(draft: string): string {
  return canonicalTag(tagSlug(draft))
}

// Why a class cannot be added yet, or '' when it can.
//
// The order is the point: the first thing wrong is the only thing said, so a
// student fixes one at a time instead of reading a list of four. The time
// comparison is a string comparison on purpose, since '' sorts before every
// real time, which is how a cleared start time used to pass this and land the
// class at midnight.
export function classProblem(
  course: string, from: string, to: string, where: string,
): string {
  if (!course.trim()) return 'Give the class a course code.'
  if (!from || !to) return 'Fill in both times.'
  if (to <= from) return 'The end time has to be after the start time.'
  if (!where) return 'Pick the building the class is in.'
  return ''
}
