import { noiseWords } from '../lib/labels'
import { useEffect, useId, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import {
  addClassMeeting, getBuildings, getClassMeetings, getProfile, removeClassMeeting, saveProfile,
} from '../lib/campusData'
import { studentFacing } from '../lib/firestoreData'
import { useDataVersion } from '../lib/useDataVersion'
import { useSession } from '../lib/session'
import type { Building, ClassMeeting, Permit, Profile } from '../types'
import Panel from './Panel'
import PageHeader from './PageHeader'
import SectionHeader from './SectionHeader'
import { CalendarIcon, UserIcon } from './icons'
import { DAYS, clockText } from '../lib/time'
// CSUF's own four categories. Visitor means an hourly permit, which is what
// CSUF sells guests instead of giving them a lot of their own.
const PERMITS: Permit[] = ['student', 'employee', 'resident', 'visitor']

// The stored values are the lowercase ones above, which is what the lot rows
// are matched on, so only the labels are capitalized here. Visitor says hourly
// because that is the word the lot it unlocks is described with everywhere
// else, and a student holding an hourly permit otherwise has to work out on
// their own that they are a visitor.
//
// Resident says campus housing for the same reason, and it matters more. CSUF
// means the housing permit by it, but half of Fullerton lives in the city of
// Fullerton and reads the word as themselves. The permit is a filter and not a
// score, so picking it for that reason handed back three lots they would be
// ticketed in, labelled as recommendations.
const PERMIT_LABELS: Record<Permit, string> = {
  student: 'Student',
  employee: 'Employee',
  resident: 'Resident (campus housing)',
  visitor: 'Visitor (hourly)',
}

// A blank name or major is stored as nothing rather than as an empty string,
// so "has this been filled in" has one answer and not two.
const orNull = (value: string) => (value.trim() ? value : null)

// Keyed on whose profile it is, so a draft typed in the demo can never be put
// back into a real account's form. That is the same hazard saveProfile checks
// for, and a draft outliving a sign in is one more way to reach it.
const draftKey = (id: string) => `tuffyflow:profile-draft:${id}`

// Both ends of the draft are guarded because sessionStorage throws outright in
// a private window and in some embedded browsers, and JSON.parse throws on
// anything that is not what we wrote. Losing a draft is a nuisance. A profile
// screen that will not render because storage said no is a bug.
function readDraft(key: string, saved: Profile): Profile | null {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return null
    const draft = JSON.parse(stored) as Profile
    // A draft survives a reload, so one written by an earlier version of the
    // app can outlive the shape it was written in, and half a profile would
    // crash the tag fields rather than restore anything. Measured against what
    // loaded instead of taken on trust.
    const whole = Object.keys(saved).every((field) => field in draft)
      && Array.isArray(draft.interests) && Array.isArray(draft.career_goals)
    return whole ? draft : null
  } catch {
    return null
  }
}

async function loadProfile() {
  const [profile, meetings, buildings] = await Promise.all([
    getProfile(), getClassMeetings(), getBuildings(),
  ])
  return { profile, meetings, buildings }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule px-5 py-3 last:border-b-0 sm:grid sm:grid-cols-[12rem_1fr] sm:items-center sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      <div className="mt-1 text-sm sm:mt-0">{children}</div>
    </div>
  )
}

// rule-strong, not rule. index.css says why: rule is a card edge sitting on
// the paper background and manages 1.3:1 on white, which is nothing. That is
// fine for a card and not fine for every field on the one screen that is
// nothing but fields. min-h-11 so a field is a comfortable size to tap; the
// remove button on a tag chip is still 24px, which clears the minimum but not
// this, because the chip itself is one line of 12px text and a 36px button
// inside it is taller than the chip.
//
// The placeholder override is because the stock one is the text color at half
// alpha, which composites to 3.1:1 on white.
const input = 'min-h-11 rounded-md border border-rule-strong bg-white px-2.5 py-1.5 ' +
  'text-sm placeholder:text-ink-faint'

// Interests and career goals are free text, because the tag vocabulary is ours
// and a student should be able to add one we did not think of.
// label reads inside a sentence ("Add an interest"), field names the list it
// belongs to, because the same tag is allowed in both and "Remove ai" on its
// own does not say which one it would come out of
// What db/firestore.rules allows, kept in step by hand: at most twelve
// tags, each at most 32 characters.
const MOST_TAGS = 12
const LONGEST_TAG = 32

// hintId is the one sentence under the Interests row that says how these are
// matched. It is passed to both fields, not only the one it is printed under,
// because it is true of both and somebody reading the career goals box by
// keyboard never reaches the line above it.
function TagField({ label, field, tags, onChange, hintId }: {
  label: string; field: string; tags: string[]; onChange: (next: string[]) => void
  hintId: string
}) {
  const [draft, setDraft] = useState('')
  // bad is kept apart from the words, because the line is not only for
  // refusals any more and a tag that went on fine should not be printed in the
  // same red as one that was turned away
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null)
  const box = useRef<HTMLInputElement>(null)
  const noteId = useId()
  const saying = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Saying the same thing twice leaves the text unchanged, and an unchanged
  // live region says nothing, so pressing Add twice on the same bad input was
  // silent the second time. Emptying it first gives it something to change
  // from. The login card does the same thing for the same reason.
  //
  // The id is held so the second commit can be called off. Nothing reaches
  // this without leaving the field on screen, so it is not a bug waiting to
  // happen, but a timer that sets state after the field is gone is not
  // something to leave lying around either.
  function say(text: string, bad = true) {
    setNote(null)
    clearTimeout(saying.current)
    saying.current = setTimeout(() => setNote({ bad, text }), 0)
  }

  useEffect(() => () => clearTimeout(saying.current), [])

  function add() {
    // An empty box and text that normalized away both left tag empty, so
    // pressing Add on an empty box answered "Letters and numbers only." and
    // named a cause that was not there.
    if (!draft.trim()) { say('Type something to add first.'); return }
    // club and event tags are lowercase words joined by hyphens, so anything
    // else can never match one and is only dead weight on the profile
    const tag = draft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!tag) { say('Letters and numbers only.'); return }
    if (tags.includes(tag)) { say(`You already have ${tag}.`); setDraft(''); return }
    // Same ceiling as db/firestore.rules. Said here rather than left to the
    // database, which would refuse the write and leave the student reading an
    // error about security rules because they typed one interest too many.
    // Names the list, because there are two of these fields on the screen.
    if (tags.length >= MOST_TAGS) { say(`${MOST_TAGS} ${field} is the most you can have.`); return }
    onChange([...tags, tag])
    setDraft('')
    // the chip appearing is the whole answer if you can see it, and nothing at
    // all if you cannot. The add row in the schedule already says its own
    // success out loud, so these match it.
    say(`${tag} added to ${field}.`, false)
  }

  function drop(tag: string) {
    box.current?.focus()
    onChange(tags.filter((x) => x !== tag))
    say(`${tag} removed from ${field}.`, false)
  }
  return (
    <div>
      <ul aria-label={field} className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <li key={t} className="inline-flex items-center gap-1 rounded-md bg-titan-50 px-2 py-1 text-xs font-medium text-titan">
            {t}
            <button
              type="button"
              onClick={() => drop(t)}
              aria-label={`Remove ${t} from ${field}`}
              className="grid h-6 w-6 place-items-center rounded text-titan hover:bg-white hover:text-flame-ink"
            >
              ×
            </button>
          </li>
        ))}
        {tags.length === 0 && <li className="text-sm text-ink-faint">None yet.</li>}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          ref={box}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setNote(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          aria-label={`New ${label.replace(/^an? /, '')}`}
          aria-describedby={`${hintId} ${noteId}`}
          // robotics was on two clubs out of 320, so the one example the screen
          // gave was a word that matches almost nothing. leadership is on 59,
          // and it reads as either an interest or a career goal, which matters
          // because both fields print this same placeholder.
          placeholder="leadership"
          maxLength={LONGEST_TAG}
          className={input + ' w-36'}
        />
        <button type="button" onClick={add} aria-label={`Add ${label}`}
                className="min-h-11 rounded-md border border-rule-strong px-3 text-sm font-medium text-titan hover:border-titan">
          Add
        </button>
      </div>
      {/* there are two of these fields, so a bare "Add" button says nothing
          about which one it is. Rendered from the start, like every other
          live region here. */}
      <p id={noteId} role="status"
         className={note ? 'mt-1 text-xs ' + (note.bad ? 'text-flame-ink' : 'text-ok') : 'sr-only'}>
        {note?.text}
      </p>
    </div>
  )
}

function Details({ saved }: { saved: Profile }) {
  const session = useSession()
  const key = draftKey(saved.id)
  // Read once, on the first render, because the answer decides both what the
  // fields start as and whether the line under the button says anything. A
  // draft that matches what loaded is nothing to restore and nothing to
  // mention, and ignoring it is also what stops one left behind by a save made
  // in another tab from being laid back over the newer rows.
  const [restored] = useState(() => {
    const draft = readDraft(key, saved)
    return draft && JSON.stringify(draft) !== JSON.stringify(saved) ? draft : null
  })
  const [form, setForm] = useState<Profile>(restored ?? saved)
  const permitNoteId = useId()
  const noiseNoteId = useId()
  const tagsNoteId = useId()
  const majorNoteId = useId()
  const noteId = useId()
  const [note, setNote] = useState(restored ? 'Restored what you had typed. Not saved yet.' : '')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  // The fields above lived nowhere but this component's state, and the app
  // renders a screen off the current view, so anything that moved the hash
  // unmounted the form and threw every unsaved answer away: a sidebar button,
  // the bottom bar a phone puts directly under the form, the account menu, or
  // Back, which remounts and re-reads the database rather than bringing the
  // typing back. Parked on every change rather than on the way out, because no
  // single event covers a hash change, a Back and a closed tab between them.
  //
  // It only writes. Clearing it here was wrong: Discard puts the form back to
  // what loaded, so this fired with nothing dirty and threw away the draft
  // that exists to protect those edits, with no way back. Only a save that
  // went through clears it now, which is the one point where the typing is
  // somewhere safer than sessionStorage.
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify(form))
    } catch {
      // Storage is refused in a private window and in some embedded browsers.
      // The form still works there, it just cannot carry a draft across a
      // navigation, and that is not worth an error in front of a student.
    }
  }, [key, form, dirty])

  // Clearing the note matters. It outlived the thing it was about: save, then
  // edit a field, and the line still read "Saved. Your recommendations are up
  // to date." next to a Save button that had gone live again. After a failure it was
  // worse, leaving red text beside a button that was ready to work.
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setNote('')
    setFailed(false)
    setForm((current) => ({ ...current, [k]: v }))
  }

  // Saving used to be fire and forget, which was fair enough when it only
  // assigned a variable. It is a write to a database now and can be refused,
  // so the answer has to reach the screen.
  async function save() {
    if (!dirty || busy) return
    setBusy(true)
    setNote('')
    try {
      await saveProfile(form)
      setFailed(false)
      // The one point where the typing is somewhere better than sessionStorage,
      // so this is the only place the draft comes off.
      try {
        sessionStorage.removeItem(key)
      } catch {
        // same storage that can refuse a write can refuse a delete, and a
        // leftover draft that matches what loaded is never restored anyway
      }
      // Only an account was written to. The demo's profile is a module
      // variable in campusData.ts, so telling someone it was saved was a
      // promise the app cannot keep past the next reload. Neither line talks
      // about rescoring any more: that happened on a screen the student is not
      // looking at, in words only we use.
      setNote(session.kind === 'account'
        ? 'Saved. Your recommendations are up to date.'
        : 'Updated for this visit. A reload puts the sample student back.')
    } catch (e) {
      setFailed(true)
      // Not e.message. A rules refusal and an App Check failure both come back
      // as a sentence with db/firestore.rules in it, written for whoever set
      // the project up, and this screen printed it straight through. The one
      // list of what may be shown lives next to the sentences themselves, in
      // firestoreData, so that rewording one cannot stop it matching.
      setNote(studentFacing(e instanceof Error ? e.message : '', 'That did not save. Try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      {/* The note does not repeat the page header, which already says these are
          what the recommendations are matched against. It says which of the two
          save models this card is on: the schedule under it writes the moment
          you press a button, this one waits, and nothing on the screen said so. */}
      <SectionHeader icon={<UserIcon className="h-4 w-4" />} title="Your details"
                     note="Nothing here is saved until you press Save changes." />
      <div className="overflow-hidden rounded-xl border border-rule bg-white">
        <Row label="Name">
          <input value={form.full_name ?? ''} onChange={(e) => set('full_name', orNull(e.target.value))}
                 maxLength={200}
                 aria-label="Name" className={input + ' w-full max-w-xs'} />
        </Row>
        <Row label="Parking permit">
          {/* Empty is a real state, not a placeholder: the column is nullable
              because a new account has not said yet. Nothing is recommended
              while it is empty, which is the honest answer, so the line
              underneath says that rather than leaving an empty screen to
              explain itself. */}
          <select value={form.permit_type ?? ''} aria-label="Parking permit"
                  aria-describedby={form.permit_type === null ? permitNoteId : undefined}
                  onChange={(e) => set('permit_type', (e.target.value || null) as Permit | null)}
                  className={input}>
            <option value="">Not set</option>
            {PERMITS.map((p) => <option key={p} value={p}>{PERMIT_LABELS[p]}</option>)}
          </select>
          {form.permit_type === null && (
            <p id={permitNoteId} className="mt-1 text-xs text-ink-faint">
              Parking stays empty until this is set, because every lot takes
              some permits and not others.
            </p>
          )}
        </Row>
        <Row label="Noise preference">
          {/* A div, not a label. The words used to be inside the label with
              the slider, and a label forwards a click to its control, so
              tapping "Not set. Move it to choose." fired the input's onClick
              and committed a 3 the student never picked, with the form dirty
              to prove it. The label was only ever a click target: the slider
              names itself with aria-label, so nothing is lost by dropping it.
              min-h-11 stays here, on the row, so the row is still a
              comfortable height to tap. */}
          <div className="flex min-h-11 items-center gap-3">
            {/* A range input has to sit somewhere, so an unset one sits in the
                middle. The words next to it are what stop the middle reading
                as an answer we already have. */}
            {/* The click handler is for one answer that is otherwise
                unreachable: dragging to where the thumb already sits fires no
                change event, so a student whose honest answer is the 3 it is
                parked on could never give it. A click commits what it shows. */}
            <input type="range" min={1} max={5} value={form.noise_pref ?? 3}
                   onChange={(e) => set('noise_pref', Number(e.target.value))}
                   onClick={() => { if (form.noise_pref === null) set('noise_pref', 3) }}
                   aria-label="Noise preference, 1 is quietest"
                   aria-describedby={noiseNoteId}
                   // the thumb has to sit somewhere, and read out as a 3 it
                   // would be an answer nobody gave
                   aria-valuetext={form.noise_pref === null ? 'not set' : `${form.noise_pref} of 5, ${noiseWords[form.noise_pref]}`}
                   className="h-6" />
            <span className="text-sm text-ink-soft">
              {form.noise_pref === null
                ? 'Not set. Move it to choose.'
                : `${form.noise_pref} of 5, ${noiseWords[form.noise_pref]}`}
            </span>
          </div>
          {/* The number is a ceiling and read as a target. api/scoring.py:347
              gives anywhere at or under it a full mark and only takes marks off
              above it, so a 3 is not a request for background noise, it is the
              most noise you will put up with. Nothing on the screen said which
              of the two it was. */}
          <p id={noiseNoteId} className="mt-1 text-xs text-ink-faint">
            This is the most noise you want. Anywhere quieter is just as good a
            match, and louder ones rank lower.
          </p>
        </Row>
        <Row label="Interests">
          <TagField label="an interest" field="interests" tags={form.interests}
                    onChange={(v) => set('interests', v)} hintId={tagsNoteId} />
          {/* Two problems, one sentence each, and both fields point at this.
              The first: nothing treats the two lists differently. ClubsView and
              api/scoring.py:393 both union them, so a student can spend real
              time deciding which box software engineering belongs in and change
              nothing by it. The fields stay because the deck promises both.
              The second: the match is set intersection against the 29 tags the
              clubs actually carry, so a typed word that is not one of them is
              accepted, confirmed in green, saved, and matches nothing for the
              rest of the term. Putting the 29 in a menu here is a bigger job
              than a sentence, so the sentence points at the one place that
              lists the club ones with counts, but the events carry four tags
              no club has, so pointing only at that menu sent a student away
              from the word that would have worked. The cards are the honest
              place to read them off. */}
          <p id={tagsNoteId} className="mt-1 text-xs text-ink-faint">
            Interests and career goals feed the same matching, so it does not
            matter which list a word goes in. Words are matched exactly, so the
            ones to copy are the tags printed on the club and event cards
            themselves.
          </p>
        </Row>
        <Row label="Career goals">
          <TagField label="a career goal" field="career goals" tags={form.career_goals}
                    onChange={(v) => set('career_goals', v)} hintId={tagsNoteId} />
        </Row>
        {/* Last, and it used to be second. Its only reader is the line under
            the name in TopBar.tsx:105. It is not in the scorer at all, so on a
            card whose heading says this is what the recommendations are matched
            against it was sitting above four fields that really are. */}
        <Row label="Major">
          <input value={form.major ?? ''} onChange={(e) => set('major', orNull(e.target.value))}
                 placeholder="Computer Science" maxLength={200}
                 aria-describedby={majorNoteId}
                 aria-label="Major" className={input + ' w-full max-w-xs'} />
          <p id={majorNoteId} className="mt-1 text-xs text-ink-faint">
            This labels your account. It is not used for recommendations.
          </p>
        </Row>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* aria-disabled rather than disabled: a disabled button that has focus
            hands focus back to the body, and this one disables the moment you
            save it */}
        <button
          type="button"
          aria-disabled={!dirty || busy}
          aria-describedby={noteId}
          onClick={() => void save()}
          className={
            'min-h-11 rounded-lg px-4 text-sm font-medium ' +
            (dirty && !busy
              ? 'bg-titan text-white hover:bg-titan-700'
              // ink on rule computes to 11.9:1, which is more insistent than
              // anything else on the screen and this one is switched off
              : 'cursor-not-allowed bg-rule text-ink-soft')
          }
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {/* ml-auto. This sat 12px from Save, so the next thing a thumb found
            after pressing Save was the button that throws the edits away, and
            it is instant and total. Pushed to the other end of the row, and it
            says what it discards. */}
        {dirty && !busy && (
          <button type="button" onClick={() => { setForm(saved); setNote('') }}
                  className="ml-auto min-h-11 px-2 text-sm font-medium text-titan hover:underline">
            Discard changes
          </button>
        )}
        {/* Its own line, at text-sm, with a background behind it. It used to be
            a text-xs grey span wedged in beside the two buttons, where a
            360px phone wrapped the answer to the most consequential control on
            the screen into four lines of 12px. A failure in particular read as
            nothing having happened, because the button went back to looking
            exactly as it had before the press. Same shape as the login card,
            which answers the same question. */}
        <p
          id={noteId}
          role="status"
          className={
            failed
              ? 'w-full rounded-lg bg-tint-parking px-3 py-2 text-sm text-flame-ink'
              // green is for a save that went through, which is the only note
              // left standing with nothing still unsaved. The restored line
              // and "Not saved yet." are neither good news nor bad.
              : note && !dirty
                ? 'w-full rounded-lg bg-ok-soft px-3 py-2 text-sm text-ok'
                : note || dirty ? 'w-full text-sm text-ink-soft' : 'sr-only'
          }
        >
          {note || (dirty ? 'Not saved yet.' : '')}
        </p>
      </div>
    </section>
  )
}

function AddClass({ buildings: unsorted }: { buildings: Building[] }) {
  // Sorted here rather than relying on the order they arrive in. The database
  // hands them back by name and the sample rows come in the order they are
  // written, so without this the list reshuffles when somebody signs in, and
  // whichever one the form had picked silently becomes a different building.
  const buildings = [...unsorted].sort((a, b) => a.name.localeCompare(b.name))
  const [course, setCourse] = useState('')
  const [day, setDay] = useState(1)
  const [from, setFrom] = useState('09:00')
  const [to, setTo] = useState('10:15')
  // Starts empty on purpose. Picking the first building for them looked
  // harmless, but the list is sorted by name, so the form quietly said the
  // class was in the bookstore and every walk time, arrive-by and lot
  // ranking was then measured from the wrong side of campus.
  const [where, setWhere] = useState('')
  // the form is empty on arrival, so without this it greeted everyone with
  // "Give the class a course code." as though they had already done something
  // wrong. The paragraph itself always renders, like every other live region
  // here.
  const [touched, setTouched] = useState(false)
  // Whatever happened the last time Add class was pressed. Separate from the
  // validation line above, which is about what is in the boxes right now.
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null)
  // The write reads the whole schedule back before it adds anything, so it is
  // two round trips, and on campus wifi the row sat there saying nothing at
  // all while they happened. Same treatment as Save changes above.
  const [busy, setBusy] = useState(false)
  const startId = useId()
  // '' compares less than any time string, so a cleared start used to pass
  // and the class landed at midnight
  const why = !course.trim() ? 'Give the class a course code.'
    : !from || !to ? 'Fill in both times.'
    : to <= from ? 'The end time has to be after the start time.'
    : !where ? 'Pick the building the class is in.'
    : ''
  const bad = why !== ''

  async function add() {
    if (busy) return
    setTouched(true)
    setNote(null)
    if (bad) {
      // the login card does this: say which box it is about and put the cursor
      // in it, because the sentence on its own told somebody working down the
      // row by keyboard nothing about where to go back to
      if (!course.trim()) document.getElementById('add-course')?.focus()
      else if (!from || !to || to <= from) document.getElementById(startId)?.focus()
      return
    }
    const code = course.trim().toUpperCase()
    setBusy(true)
    try {
      await addClassMeeting({
        course_code: code,
        day_of_week: day,
        start_time: `${from}:00`,
        end_time: `${to}:00`,
        building_id: where,
      })
      // The course code stays in the box now. One row is one meeting on one
      // day, and a course that meets twice a week is the normal case, so the
      // next thing anybody does here is add the same code again with the day
      // changed and everything else identical. Clearing it made that two
      // typings instead of one dropdown. It cannot add a duplicate by
      // accident either: the same code on the same day at the same time is
      // refused by the write, and the refusal is a sentence they can read.
      //
      // setTouched(false) stays for what it always did. The validation line is
      // about what is in the boxes, and a success is not the moment to start
      // telling somebody what is wrong with them.
      setTouched(false)
      setNote({
        bad: false,
        text: `${code} added to ${DAYS[day]}. Add it again for each other day it meets.`,
      })
    } catch (e) {
      // The same course twice on the same day at the same time is refused,
      // so this is a sentence somebody has to read.
      setNote({
        bad: true,
        text: studentFacing(e instanceof Error ? e.message : '', 'That class did not save. Try again.'),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    // mb-3, because this sits above the week now rather than under it.
    <div className="mb-3 rounded-xl border border-rule bg-paper px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-ink-soft">
          Course
          {/* Enter on any of the three typed boxes. The row is a div rather
              than a form, because it sits inside the page's own markup, so
              Enter did nothing at all: you typed a course code, pressed it,
              and the class was not added and nothing said why. The tag fields
              two rows up have handled Enter all along. */}
          <input id="add-course" value={course}
                 onChange={(e) => { setTouched(true); setNote(null); setCourse(e.target.value) }}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
                 placeholder="CPSC 362"
                 maxLength={24} className={'mt-1 block w-32 ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Day
          <select value={day} onChange={(e) => { setNote(null); setDay(Number(e.target.value)) }}
                  className={'mt-1 block ' + input}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Starts
          <input id={startId} type="time" value={from}
                 onChange={(e) => { setNote(null); setFrom(e.target.value) }}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
                 className={'mt-1 block ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Ends
          <input type="time" value={to} onChange={(e) => { setNote(null); setTo(e.target.value) }}
                 onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
                 className={'mt-1 block ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Building
          <select value={where} onChange={(e) => { setNote(null); setWhere(e.target.value) }}
                  className={'mt-1 block max-w-48 ' + input}>
            <option value="">Pick one</option>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          aria-disabled={busy}
          onClick={() => void add()}
          className={
            'min-h-11 rounded-lg px-4 text-sm font-medium ' +
            (busy
              ? 'cursor-not-allowed bg-rule text-ink-soft'
              : 'bg-titan text-white hover:bg-titan-700')
          }
        >
          {busy ? 'Saving…' : 'Add class'}
        </button>
      </div>
      <p role="status"
         className={'mt-2 min-h-4 text-xs ' + (note && !note.bad ? 'text-ok' : 'text-flame-ink')}>
        {note?.text ?? (touched ? why : '')}
      </p>
    </div>
  )
}

function Week({ meetings, buildings }: { meetings: ClassMeeting[]; buildings: Building[] }) {
  const where = new Map(buildings.map((b) => [b.id, b.name]))
  // Which day the line belongs to, so it can be printed in that day's card.
  // It used to be one line under the whole grid, which on a phone put the
  // answer about Monday five card heights below Monday.
  const [note, setNote] = useState<{ day: string; bad: boolean; text: string } | null>(null)
  // The id of the class currently being deleted. The delete was fired without
  // waiting for it, so the row sat there unchanged for a second or two and the
  // obvious thing to do was press it again.
  const [removing, setRemoving] = useState('')
  // Saturday and Sunday are in here now. A class on either used to have nowhere
  // to show, even though the scorer already handled any day of the week.
  const week = DAYS.map((name, day) => ({
    name,
    classes: meetings
      .filter((m) => m.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }))

  async function remove(dayName: string, c: ClassMeeting) {
    if (removing) return
    // Focus goes to the day's own heading. It used to go to the next class
    // down, so a keyboard user who pressed Enter again deleted a second class,
    // and on a day holding one class it fell out of the card entirely and took
    // the viewport with it. The heading is where they were looking and there is
    // nothing destructive on it.
    document.getElementById(`day-${dayName}`)?.focus()
    setNote(null)
    setRemoving(c.id)
    try {
      await removeClassMeeting(c.id)
      // the row disappearing is the whole answer if you can see it. Said out
      // loud for the same reason the add row says its own.
      setNote({ day: dayName, bad: false, text: `${c.course_code} removed from ${dayName}.` })
    } catch (e) {
      setNote({
        day: dayName,
        bad: true,
        text: studentFacing(
          e instanceof Error ? e.message : '',
          'That class could not be removed. Try again.',
        ),
      })
    } finally {
      setRemoving('')
    }
  }

  return (
    <section>
      {/* Says the other half of what the details card says. Adding a class and
          removing one both go straight to the database, with no Save to press,
          and two save models on one screen with nothing naming either is how
          somebody ends up pressing Save changes to keep a class. */}
      <SectionHeader icon={<CalendarIcon className="h-4 w-4" />} title="Weekly schedule"
                     note="Adding or removing a class saves right away." />
      {/* Above the grid, and not only while the schedule is empty. Under the
          sm breakpoint the week is one column, so this was seven cards reading
          "None" below the only control on the screen that does anything about
          that. Every other screen puts its controls above its list. Showing it
          here only when the schedule was empty would have been worse: the form
          would move out from under the cursor the moment the first class
          landed, which is exactly when a second one is about to be typed. */}
      <AddClass buildings={buildings} />
      {/* Four across is the widest this goes. Seven was never once comfortable:
          the right rail does not mount on this screen, so at 1280px the
          content box is 976px, and seven columns with this gap left a 129px
          card, which after the border, the list padding and the remove button
          is a 71px text column for "09:00 CPSC 362", about 110px of text at
          this size. Every entry wrapped to three or four lines, and it could
          not grow out of it either, because max-w-5xl caps the content at
          1024px. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {week.map((day) => (
          <div key={day.name} className="overflow-hidden rounded-xl border border-rule bg-white">
            {/* focusable only from script, so a delete can hand focus back to
                the day it happened in without putting the heading in anybody's
                tab order */}
            <h3 id={`day-${day.name}`} tabIndex={-1}
                className="border-b border-rule bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {day.name.slice(0, 3)}
            </h3>
            {day.classes.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-faint">None</p>
            ) : (
              <ul className="px-3 py-1">
                {day.classes.map((c) => (
                  <li
                    key={c.id}
                    aria-busy={removing === c.id}
                    className={
                      'flex items-start justify-between gap-2 border-b border-rule py-2 text-sm last:border-b-0 '
                      + (removing === c.id ? 'opacity-60' : '')
                    }
                  >
                    <span className="min-w-0 break-words">
                      <span className="tabular-nums text-ink-soft">{clockText(c.start_time)}</span>{' '}
                      <span className="font-semibold text-titan">{c.course_code}</span>
                      <span className="block text-xs text-ink-faint">{where.get(c.building_id) ?? 'Campus'}</span>
                    </span>
                    {/* the time is in the name because two classes can share a
                        code and a day, and the names were identical */}
                    <button
                      type="button"
                      id={`rm-${c.id}`}
                      aria-disabled={removing === c.id}
                      onClick={() => void remove(day.name, c)}
                      aria-label={`Remove ${c.course_code} at ${clockText(c.start_time)} on ${day.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded text-ink-faint hover:bg-titan-50 hover:text-flame-ink"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* In the card, because under the grid meant a failed Monday
                delete printed its answer below Sunday, five cards further down
                a phone. Each day carries its own, present from first paint so
                a reader is already watching it. */}
            <p role="status"
               className={note?.day === day.name
                 ? 'border-t border-rule px-3 py-2 text-xs ' + (note.bad ? 'text-flame-ink' : 'text-ok')
                 : 'sr-only'}>
              {note?.day === day.name ? note.text : ''}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// What a new account has not told us yet. Every item is something the scoring
// needs and signup had no way to ask for, so this is the one screen that can
// say so. Without it the dashboard is just empty and it is not obvious why.
function Missing({ profile, meetings }: { profile: Profile; meetings: ClassMeeting[] }) {
  // The schedule is first because it is not one gap among four. Every walk on
  // every screen is measured from a class, so with none on file the dashboard
  // falls back to a single prompt and both the lot ranking and the spot ranking
  // lose the point they are measured from. The permit only empties parking.
  //
  // Each line also says where to go. The reasons were the only thing here, and
  // a student who agreed with all four still had to work out for themselves
  // which part of which screen each one was asking about.
  const gaps = [
    meetings.length === 0
      && 'your class times, which every walk is measured from, in the Weekly schedule below',
    profile.permit_type === null
      && 'your parking permit, which decides which lots you can use, in Your details below',
    profile.noise_pref === null
      && 'how quiet you want somewhere to work, on the noise slider in Your details',
    profile.interests.length + profile.career_goals.length === 0
      && 'an interest or a career goal, which is how clubs and events get matched, in Your details below',
  ].filter((gap): gap is string => typeof gap === 'string')

  if (gaps.length === 0) return null

  return (
    // Plain paper with a strong edge. It used to wear the parking tint, which
    // on every other card means "this is a lot" or "something is wrong", and
    // this one is neither: it is a list of things nobody has got round to
    // yet. text-base on the heading too, because at text-sm it was smaller
    // than the routine "Your details" heading right underneath it.
    <div className="rounded-xl border border-rule-strong bg-paper px-5 py-4">
      <h2 className="text-base font-semibold text-titan">Finish setting up</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {gaps.length === 1
          ? 'One thing is still missing, and the recommendations are thinner without it:'
          : 'These are still missing, and the recommendations are thinner without them:'}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        {gaps.map((gap) => <li key={gap}>{gap}</li>)}
      </ul>
    </div>
  )
}

export default function ProfileView() {
  const data = useAsync(loadProfile, [useDataVersion()])
  const session = useSession()

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Profile">
        What the recommendations are matched against.{' '}
        {session.kind === 'account'
          ? 'Saved to your account, so it is still here the next time you log in.'
          // "nothing here is stored" was not true of the typing: an unsaved
          // form is parked in sessionStorage and comes back on reload saying
          // so, which read as a straight contradiction. Narrowed to what is
          // actually true, which is that nothing saved here outlives a reload.
          : 'This is the sample student everyone sees. Nothing you save here is kept, so a reload puts the sample student back.'}
      </PageHeader>

      <Panel source={data}>
        {({ profile, meetings, buildings }) => (
          <>
            <Missing profile={profile} meetings={meetings} />
            {/* Keyed on whose profile this is. Both of these keep state built
                from their first render: the form fields, and which building
                the add row has selected. If the person changes underneath
                them, which a sign in in another tab does, that state is the
                previous person's, and one
                click on Save would write the sample student over a real
                account. The key makes them start again instead. */}
            <Details key={`details-${profile.id}`} saved={profile} />
            <Week key={`week-${profile.id}`} meetings={meetings} buildings={buildings} />
          </>
        )}
      </Panel>
    </div>
  )
}
