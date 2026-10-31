// The Clubs screen was the one promised feature with no test on its ranking.
// The order it produces is the whole point of the screen, and the bug that
// forced the current design was found by hand and fixed without a regression
// test. src/lib/clubRanking.ts has the reasoning; these pin the behaviour.
//
//   npm run test:clubs
import test from 'node:test'
import assert from 'node:assert/strict'

import { clubs } from '../src/lib/campusRows.ts'
import { clubRanking, tagCounts } from '../src/lib/clubRanking.ts'

// A club row. The ranking reads only name and tags; the rest are here to
// satisfy the Club type in src/types.ts and are left empty on purpose.
function club(name, tags) {
  return { id: name, titanlink_id: null, name, summary: null, website_key: null, categories: [], tags }
}

// What the screen does between the filters and the page slice.
function order(list, mine) {
  const ranking = clubRanking(list, mine)
  const scored = list.map((c) => ({ club: c, shared: c.tags.filter((t) => mine.has(t)) }))
  return [...scored].sort(ranking.compare).map((s) => s.club.name)
}

test('tagCounts counts every club, not the ones on screen', () => {
  const counts = tagCounts([club('A', ['ai', 'social']), club('B', ['social']), club('C', [])])
  assert.equal(counts.get('social'), 2)
  assert.equal(counts.get('ai'), 1)
  assert.equal(counts.get('music'), undefined)
})

// The design intent, stated as plainly as it can be: one rare tag beats three
// common ones. Deleting the 1/count weighting flips this.
test('one rare shared interest outranks three common ones', () => {
  const list = [
    club('Common Three', ['social', 'career', 'service']),
    club('Rare One', ['robotics']),
    // the three common tags have to be common, so give them company
    ...Array.from({ length: 40 }, (_, i) => club(`Filler ${i}`, ['social', 'career', 'service'])),
  ]
  const mine = new Set(['social', 'career', 'service', 'robotics'])
  assert.deepEqual(order(list, mine).slice(0, 2), ['Rare One', 'Common Three'])
})

// The same failure as the one clubRanking describes, on a profile narrow
// enough to state in one line. By a count of shared tags the choral club wins
// on two common tags, career and music; by rarity the data club wins on one
// rare one. Both clubs and all three tag frequencies are the shipped data.
test('the real club list puts the rare interest first', () => {
  const counts = tagCounts(clubs)
  // if these move a long way the test below is measuring something else
  assert.equal(counts.get('data-science'), 2)
  assert.equal(counts.get('music'), 18)
  assert.equal(counts.get('career'), 105)

  const mine = new Set(['data-science', 'music', 'career'])
  const names = order(clubs, mine)
  const data = names.indexOf('Business and Data Analytics Club')
  const choral = names.indexOf('American Choral Directors Association')
  assert.ok(data !== -1 && choral !== -1, 'both clubs are still in the list')

  // the choral club shares two of the three interests, the data club one
  const byName = new Map(clubs.map((c) => [c.name, c]))
  assert.equal(byName.get('American Choral Directors Association').tags.filter((t) => mine.has(t)).length, 2)
  assert.equal(byName.get('Business and Data Analytics Club').tags.filter((t) => mine.has(t)).length, 1)

  assert.ok(data < choral, 'one rare shared interest beats two common ones')
})

test('the badge names the rarest shared interest first', () => {
  const { bySignal } = clubRanking(clubs, new Set())
  assert.deepEqual(bySignal(['social', 'ai', 'career']), ['ai', 'career', 'social'])
  // and it does not reorder the caller's array
  const given = ['social', 'ai']
  bySignal(given)
  assert.deepEqual(given, ['social', 'ai'])
})

// The closed vocabulary is 29 tags. A profile outside it, or an empty one,
// shares nothing with any club, and the header and the empty state both read
// canMatch to avoid promising an order they are not giving.
test('interests outside the tag list match nothing', () => {
  assert.equal(clubRanking(clubs, new Set(['underwater-basket-weaving'])).canMatch, false)
  assert.equal(clubRanking(clubs, new Set()).canMatch, false)
  assert.equal(clubRanking(clubs, new Set(['ai'])).canMatch, true)
  // one real interest among nonsense still counts
  assert.equal(clubRanking(clubs, new Set(['nonsense', 'music'])).canMatch, true)
})

test('with nothing shared the order is the alphabet', () => {
  const list = [club('Zebra', ['social']), club('Apple', ['career']), club('Mango', [])]
  assert.deepEqual(order(list, new Set(['robotics'])), ['Apple', 'Mango', 'Zebra'])
})

// Two clubs that tie on weight have to come out in the same order every
// render, or the list reshuffles under a reader when anything else changes.
test('a tie is broken by name, so the list never reshuffles', () => {
  const list = [club('Beta', ['ai']), club('Alpha', ['ai'])]
  const mine = new Set(['ai'])
  assert.deepEqual(order(list, mine), ['Alpha', 'Beta'])
  assert.deepEqual(order([...list].reverse(), mine), ['Alpha', 'Beta'])
})
