// clockText is the single point of failure for every time a student reads, and
// it had no test. The two cases worth pinning are midnight and noon: replacing
// the `hour % 12 === 0 ? 12 : hour % 12` branch with a bare `hour % 12` breaks
// both, and nothing else in the suite would notice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clockText } from '../src/lib/time.ts'

test('clockText', () => {
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
