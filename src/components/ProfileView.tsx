import { useId, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import {
  addClassMeeting, getBuildings, getClassMeetings, getProfile, removeClassMeeting, saveProfile,
} from '../lib/campusData'
import { useDataVersion } from '../lib/useDataVersion'
import { useSession } from '../lib/session'
import type { Building, ClassMeeting, Permit, Profile } from '../types'
import Panel from './Panel'
import PageHeader from './PageHeader'
import SectionHeader from './SectionHeader'
import { CalendarIcon, UserIcon } from './icons'
import { DAYS } from '../lib/time'
// CSUF's own four categories. Visitor means an hourly permit, which is what
// CSUF sells guests instead of giving them a lot of their own.
const PERMITS: Permit[] = ['student', 'employee', 'resident', 'visitor']

// A blank name or major is stored as nothing rather than as an empty string,
// so "has this been filled in" has one answer and not two.
const orNull = (value: string) => (value.trim() ? value : null)

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
// two small remove buttons further down are still 24px, which clears the
// minimum but not this.
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
function TagField({ label, field, tags, onChange }: {
  label: string; field: string; tags: string[]; onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const box = useRef<HTMLInputElement>(null)
  const noteId = useId()

  // Saying the same thing twice leaves the text unchanged, and an unchanged
  // live region says nothing, so pressing Add twice on the same bad input was
  // silent the second time. Emptying it first gives it something to change
  // from. The login card does the same thing for the same reason.
  function say(text: string) {
    setNote('')
    setTimeout(() => setNote(text), 0)
  }

  function add() {
    // club and event tags are lowercase words joined by hyphens, so anything
    // else can never match one and is only dead weight on the profile
    const tag = draft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!tag) { say('Letters and numbers only.'); return }
    if (tags.includes(tag)) { say(`You already have ${tag}.`); setDraft(''); return }
    onChange([...tags, tag])
    setDraft('')
    setNote('')
  }

  function drop(tag: string) {
    box.current?.focus()
    onChange(tags.filter((x) => x !== tag))
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
          onChange={(e) => { setDraft(e.target.value); setNote('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          aria-label={`New ${label.replace(/^an? /, '')}`}
          aria-describedby={noteId}
          placeholder="add one"
          maxLength={32}
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
      <p id={noteId} role="status" className={note ? 'mt-1 text-xs text-flame-ink' : 'sr-only'}>
        {note}
      </p>
    </div>
  )
}

function Details({ saved }: { saved: Profile }) {
  const [form, setForm] = useState<Profile>(saved)
  const permitNoteId = useId()
  const [note, setNote] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  // Clearing the note matters. It outlived the thing it was about: save, then
  // edit a field, and the line still read "Saved. The dashboard rescored."
  // next to a Save button that had gone live again. After a failure it was
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
      setNote('Saved. The dashboard rescored.')
    } catch (e) {
      setFailed(true)
      setNote(e instanceof Error ? e.message : 'That did not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionHeader
        icon={<UserIcon className="h-4 w-4" />}
        title="Your details"
        note="These are what every recommendation is scored against."
      />
      <div className="overflow-hidden rounded-xl border border-rule bg-white">
        <Row label="Name">
          <input value={form.full_name ?? ''} onChange={(e) => set('full_name', orNull(e.target.value))}
                 aria-label="Name" className={input + ' w-full max-w-xs'} />
        </Row>
        <Row label="Major">
          <input value={form.major ?? ''} onChange={(e) => set('major', orNull(e.target.value))}
                 placeholder="Computer Science"
                 aria-label="Major" className={input + ' w-full max-w-xs'} />
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
            <option value="">not set</option>
            {PERMITS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          {form.permit_type === null && (
            <p id={permitNoteId} className="mt-1 text-xs text-ink-faint">
              Parking stays empty until this is set, because every lot takes
              some permits and not others.
            </p>
          )}
        </Row>
        <Row label="Noise preference">
          <label className="flex min-h-11 items-center gap-3">
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
                   // the thumb has to sit somewhere, and read out as a 3 it
                   // would be an answer nobody gave
                   aria-valuetext={form.noise_pref === null ? 'not set' : `${form.noise_pref} of 5`}
                   className="h-6" />
            <span className="text-sm text-ink-soft">
              {form.noise_pref === null
                ? 'Not set. Move it to choose.'
                : `${form.noise_pref} of 5, quieter is lower`}
            </span>
          </label>
        </Row>
        <Row label="Interests">
          <TagField label="an interest" field="interests" tags={form.interests}
                    onChange={(v) => set('interests', v)} />
        </Row>
        <Row label="Career goals">
          <TagField label="a career goal" field="career goals" tags={form.career_goals}
                    onChange={(v) => set('career_goals', v)} />
        </Row>
      </div>

      <div className="mt-3 flex items-center gap-3">
        {/* aria-disabled rather than disabled: a disabled button that has focus
            hands focus back to the body, and this one disables the moment you
            save it */}
        <button
          type="button"
          aria-disabled={!dirty || busy}
          onClick={() => void save()}
          className={
            'min-h-11 rounded-lg px-4 text-sm font-medium ' +
            (dirty && !busy
              ? 'bg-titan text-white hover:bg-titan-700'
              : 'cursor-not-allowed bg-rule text-ink')
          }
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {dirty && !busy && (
          <button type="button" onClick={() => { setForm(saved); setNote('') }}
                  className="min-h-11 px-2 text-sm font-medium text-titan hover:underline">
            Discard
          </button>
        )}
        <span role="status" className={'text-xs ' + (failed ? 'text-flame-ink' : 'text-ink-faint')}>
          {note || (dirty ? 'Not saved yet.' : '')}
        </span>
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
  const [where, setWhere] = useState(buildings[0]?.id ?? '')
  // the form is empty on arrival, so without this it greeted everyone with
  // "Give the class a course code." as though they had already done something
  // wrong. The paragraph itself always renders, like every other live region
  // here.
  const [touched, setTouched] = useState(false)
  // Whatever happened the last time Add class was pressed. Separate from the
  // validation line above, which is about what is in the boxes right now.
  const [note, setNote] = useState<{ bad: boolean; text: string } | null>(null)
  // '' compares less than any time string, so a cleared start used to pass
  // and the class landed at midnight
  const why = !course.trim() ? 'Give the class a course code.'
    : !from || !to ? 'Both times are needed.'
    : to <= from ? 'The end time has to be after the start time.'
    : ''
  const bad = why !== ''

  async function add() {
    setTouched(true)
    setNote(null)
    if (bad) return
    const code = course.trim().toUpperCase()
    try {
      await addClassMeeting({
        course_code: code,
        day_of_week: day,
        start_time: `${from}:00`,
        end_time: `${to}:00`,
        building_id: where,
      })
      setCourse('')
      // Clearing the box makes the validation line true again, so adding a
      // class used to tell you off for not having typed a course code, in
      // red, every single time it worked. The box is empty because it
      // worked, which is the opposite of untouched.
      setTouched(false)
      setNote({ bad: false, text: `${code} added to ${DAYS[day]}.` })
    } catch (e) {
      // The same course twice on the same day at the same time is refused,
      // so this is a sentence somebody has to read.
      setNote({ bad: true, text: e instanceof Error ? e.message : 'That class did not save.' })
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-rule bg-paper px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-ink-soft">
          Course
          <input id="add-course" value={course}
                 onChange={(e) => { setTouched(true); setNote(null); setCourse(e.target.value) }}
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
          <input type="time" value={from} onChange={(e) => { setNote(null); setFrom(e.target.value) }}
                 className={'mt-1 block ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Ends
          <input type="time" value={to} onChange={(e) => { setNote(null); setTo(e.target.value) }}
                 className={'mt-1 block ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Building
          <select value={where} onChange={(e) => { setNote(null); setWhere(e.target.value) }}
                  className={'mt-1 block max-w-48 ' + input}>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void add()}
          className="min-h-11 rounded-lg bg-titan px-4 text-sm font-medium text-white hover:bg-titan-700"
        >
          Add class
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
  const [failed, setFailed] = useState('')
  // Saturday and Sunday are in here now. A class on either used to have nowhere
  // to show, even though the scorer already handled any day of the week.
  const week = DAYS.map((name, day) => ({
    name,
    classes: meetings
      .filter((m) => m.day_of_week === day)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  }))

  return (
    <section>
      <SectionHeader icon={<CalendarIcon className="h-4 w-4" />} title="Weekly schedule" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {week.map((day) => (
          <div key={day.name} className="overflow-hidden rounded-xl border border-rule bg-white">
            <h3 className="border-b border-rule bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {day.name.slice(0, 3)}
            </h3>
            {day.classes.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-faint">None</p>
            ) : (
              <ul className="px-3 py-1">
                {day.classes.map((c, i) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 border-b border-rule py-2 text-sm last:border-b-0">
                    <span className="min-w-0 break-words">
                      <span className="tabular-nums text-ink-soft">{c.start_time.slice(0, 5)}</span>{' '}
                      <span className="font-semibold text-titan">{c.course_code}</span>
                      <span className="block text-xs text-ink-faint">{where.get(c.building_id) ?? 'Campus'}</span>
                    </span>
                    {/* the time is in the name because two classes can share a
                        code and a day, and the names were identical */}
                    <button
                      type="button"
                      id={`rm-${c.id}`}
                      onClick={() => {
                        // focus a neighbor in the same day before this button
                        // unmounts, so a phone does not jump to the form at the
                        // bottom of the page on every delete
                        const near = day.classes[i + 1] ?? day.classes[i - 1]
                        const next = near
                          ? document.getElementById(`rm-${near.id}`)
                          : document.getElementById('add-course')
                        next?.focus()
                        setFailed('')
                        removeClassMeeting(c.id).catch((e: unknown) => {
                          setFailed(e instanceof Error ? e.message : 'That class did not come off.')
                        })
                      }}
                      aria-label={`Remove ${c.course_code} at ${c.start_time.slice(0, 5)} on ${day.name}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-faint hover:bg-titan-50 hover:text-flame-ink"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p role="status" className={failed ? 'mt-2 text-xs text-flame-ink' : 'sr-only'}>{failed}</p>
      <AddClass buildings={buildings} />
    </section>
  )
}

// What a new account has not told us yet. Every item is something the scoring
// needs and signup had no way to ask for, so this is the one screen that can
// say so. Without it the dashboard is just empty and it is not obvious why.
function Missing({ profile, meetings }: { profile: Profile; meetings: ClassMeeting[] }) {
  const gaps = [
    profile.permit_type === null && 'your parking permit, which is what rules lots in or out',
    profile.noise_pref === null && 'how quiet you want somewhere to work',
    meetings.length === 0 && 'your class times, which every walk is measured from',
    profile.interests.length + profile.career_goals.length === 0
      && 'an interest or a career goal, which is how clubs and events get matched',
  ].filter((gap): gap is string => typeof gap === 'string')

  if (gaps.length === 0) return null

  return (
    <div className="rounded-xl border border-tint-parking-edge bg-tint-parking px-5 py-4">
      <h2 className="text-sm font-semibold text-titan">Finish setting up</h2>
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
          : 'This is the sample student everyone sees, so changes last until you sign out.'}
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
            <Details key={profile.id} saved={profile} />
            <Week key={profile.id} meetings={meetings} buildings={buildings} />
          </>
        )}
      </Panel>
    </div>
  )
}
