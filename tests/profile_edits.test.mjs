// The profile screen's own rules, which until now were the only logic in the
// project with nothing checking it. Two of them have to agree with
// db/firestore.rules, and the agreement was a comment saying "kept in step by
// hand". These read the rules file and check it instead, so the two drift
// apart in a test run rather than in front of a student who types a
// thirteenth interest and gets a security rules error.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LONGEST_TAG, MOST_TAGS, classProblem, tagFor, tagSlug,
} from '../src/lib/profileEdits.ts'

const rules = readFileSync(
  new URL('../db/firestore.rules', import.meta.url), 'utf8')

test('the tag ceilings match the ones the database enforces', () => {
  // aTag(): value is string && value.size() > 0 && value.size() <= 32
  const perTag = rules.match(/function aTag\(value\)[^}]*?size\(\) <= (\d+)/s)
  assert.ok(perTag, 'could not find the per tag length in db/firestore.rules')
  assert.equal(Number(perTag[1]), LONGEST_TAG,
    'the screen caps a tag at a different length from the rules')

  // the list check: value is list && value.size() <= 12
  const perList = rules.match(/value is list && value\.size\(\) <= (\d+)/)
  assert.ok(perList, 'could not find the tag list cap in db/firestore.rules')
  assert.equal(Number(perList[1]), MOST_TAGS,
    'the screen allows a different number of tags from the rules')
})

test('a typed interest becomes something the campus data can match', () => {
  // Club and event tags are lowercase and hyphenated and are compared by
  // exact string, so this is the whole reason the slug exists.
  assert.equal(tagSlug('  Machine Learning  '), 'machine-learning')
  assert.equal(tagSlug('AI'), 'ai')
  assert.equal(tagSlug('rock & roll'), 'rock-roll')
  assert.equal(tagSlug('--trimmed--'), 'trimmed')
  assert.equal(tagSlug('Data   Science'), 'data-science')
})

test('punctuation on its own produces no tag rather than an empty one', () => {
  // aTag() wants size() > 0, so an empty tag is a write the rules refuse.
  // The screen has to catch it first and say why.
  for (const draft of ['...', '   ', '!!!', '-', '@#$']) {
    assert.equal(tagSlug(draft), '', `${JSON.stringify(draft)} made a tag`)
  }
})

test('a typed interest is stored as the word the data actually uses', () => {
  // The alias table in labels.ts. Somebody typing "machine learning" used to
  // be told it had been added and then matched nothing all term.
  assert.equal(tagFor('Singing'), 'music')
  assert.equal(tagFor('theatre'), 'arts')
  // and a word with no alias is itself
  assert.equal(tagFor('robotics'), 'robotics')
})

test('no tag the screen will store is longer than the database allows', () => {
  // The box has a maxLength, but a paste can still be trimmed and hyphenated
  // into something longer than it started. This is the case that would reach
  // the rules and be refused.
  const typed = 'a'.repeat(LONGEST_TAG)
  assert.ok(tagSlug(typed).length <= LONGEST_TAG)
  assert.ok(tagFor(typed).length <= LONGEST_TAG,
    'an alias expanded a tag past what the rules accept')
})

test('a class says the first thing wrong with it and only that', () => {
  const ok = ['CPSC 362', '09:00', '10:15', 'b-cs']
  assert.equal(classProblem(...ok), '')
  assert.match(classProblem('', '09:00', '10:15', 'b-cs'), /course code/)
  assert.match(classProblem('  ', '09:00', '10:15', 'b-cs'), /course code/)
  assert.match(classProblem('CPSC 362', '', '10:15', 'b-cs'), /both times/)
  assert.match(classProblem('CPSC 362', '09:00', '', 'b-cs'), /both times/)
  assert.match(classProblem('CPSC 362', '09:00', '10:15', ''), /building/)
  // Two things wrong, and it names the earlier one only, so the student
  // fixes one at a time instead of reading a list.
  assert.match(classProblem('', '', '', ''), /course code/)
})

test('a class cannot end before or when it starts', () => {
  assert.match(classProblem('CPSC 362', '10:15', '09:00', 'b-cs'), /after/)
  assert.match(classProblem('CPSC 362', '09:00', '09:00', 'b-cs'), /after/)
  // The rules say the same thing: data.end > data.start.
  assert.match(rules, /end > .*start|start < .*end/,
    'db/firestore.rules no longer requires the end after the start')
})
