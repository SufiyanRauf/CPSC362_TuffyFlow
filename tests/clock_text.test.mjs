// clockText is the single point of failure for every time a student reads, and
// it had no test. The two cases worth pinning are midnight and noon: replacing
// the `hour % 12 === 0 ? 12 : hour % 12` branch with a bare `hour % 12` breaks
// both, and nothing else in the suite would notice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clockRange, clockText, toMinutes } from '../src/lib/time.ts'

test('clockText prints midnight and noon as 12, not 0', () => {
  assert.equal(clockText('00:00'), '12:00 AM')
  assert.equal(clockText('00:15'), '12:15 AM')
  assert.equal(clockText('09:00'), '9:00 AM')
  assert.equal(clockText('11:59'), '11:59 AM')
  assert.equal(clockText('12:00'), '12:00 PM')
  assert.equal(clockText('12:45'), '12:45 PM')
  assert.equal(clockText('13:05'), '1:05 PM')
  assert.equal(clockText('23:59'), '11:59 PM')
})

test('clockText drops the seconds the database stores', () => {
  assert.equal(clockText('09:00:00'), '9:00 AM')
  assert.equal(clockText('12:45:00'), '12:45 PM')
})

test('clockText hands back anything that is not a time', () => {
  // the parking cards print "now" through the same slot when the time has gone
  assert.equal(clockText('now'), 'now')
  assert.equal(clockText(''), '')
})

test('clockRange says the meridiem once when both ends share it', () => {
  assert.equal(clockRange('09:00:00', '10:15:00'), '9:00\u201310:15 AM')
  assert.equal(clockRange('14:00:00', '15:15:00'), '2:00\u20133:15 PM')
})

test('clockRange keeps both when the range crosses noon or midnight', () => {
  // the one that has to stay long, because 11:30 and 12:45 are not both AM
  assert.equal(clockRange('11:30:00', '12:45:00'), '11:30 AM\u201312:45 PM')
  assert.equal(clockRange('23:00:00', '00:30:00'), '11:00 PM\u201312:30 AM')
})

// Everything the scorer is told about a class window goes through this, and it
// had no test at all. Changing the * 60 to a + would have gone unnoticed.
test('toMinutes counts from midnight', () => {
  assert.equal(toMinutes('09:30'), 570)
  assert.equal(toMinutes('11:30:00'), 690)
  assert.equal(toMinutes('00:00'), 0)
})

// clockText promises to hand back anything that is not a time, and clockRange
// was quietly breaking that: two passthrough values whose last two characters
// matched had three characters eaten off the first one.
test('clockRange hands back values that are not times', () => {
  assert.equal(clockRange('TBA', 'TBA'), 'TBA\u2013TBA')
  assert.equal(clockRange('', ''), '\u2013')
  assert.equal(clockRange('now', 'now'), 'now\u2013now')
})
