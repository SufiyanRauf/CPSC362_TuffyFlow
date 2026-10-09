import { useId, useRef, useState } from 'react'
import { useAsync } from '../lib/useAsync'
import {
  addClassMeeting, getBuildings, getClassMeetings, getProfile, removeClassMeeting, saveProfile,
} from '../lib/campusData'
import { useDataVersion } from '../lib/useDataVersion'
import type { Building, ClassMeeting, Profile } from '../types'
import Panel from './Panel'
import PageHeader from './PageHeader'
import SectionHeader from './SectionHeader'
import { CalendarIcon, UserIcon } from './icons'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PERMITS: Profile['permit_type'][] = ['student', 'staff', 'visitor']

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

// the stock placeholder is the text color at half alpha, which lands on 4.0:1
const input = 'rounded-md border border-rule bg-white px-2.5 py-1.5 text-sm placeholder:text-ink-faint'

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

  function add() {
    // club and event tags are lowercase words joined by hyphens, so anything
    // else can never match one and is only dead weight on the profile
    const tag = draft.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!tag) { setNote('Letters and numbers only.'); return }
    if (tags.includes(tag)) { setNote(`You already have ${tag}.`); setDraft(''); return }
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
              className="grid h-6 w-6 place-items-center rounded text-titan hover:bg-titan-50 hover:text-flame-ink"
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
          aria-label={`Add ${label}`}
          aria-describedby={noteId}
          placeholder="add one"
          maxLength={32}
          className={input + ' w-36'}
        />
        <button type="button" onClick={add} aria-label={`Add ${label}`}
                className="min-h-11 rounded-md border border-rule px-3 text-sm font-medium text-titan hover:border-titan">
          Add
        </button>
      </div>
      {/* there are two of these fields, so a bare "Add" button says nothing
          about which one it is. The note is here from the start rather than
          appearing with its text already in it, which does not get read out. */}
      <p id={noteId} role="status" className={note ? 'mt-1 text-xs text-flame-ink' : 'sr-only'}>
        {note}
      </p>
    </div>
  )
}

function Details({ saved }: { saved: Profile }) {
  const [form, setForm] = useState<Profile>(saved)
  const [savedOnce, setSavedOnce] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setForm((current) => ({ ...current, [k]: v }))

  return (
    <section>
      <SectionHeader
        icon={<UserIcon className="h-4 w-4" />}
        title="Your details"
        note="These are what every recommendation is scored against."
      />
      <div className="overflow-hidden rounded-xl border border-rule bg-white">
        <Row label="Name">
          <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
                 aria-label="Name" className={input + ' w-full max-w-xs'} />
        </Row>
        <Row label="Major">
          <input value={form.major} onChange={(e) => set('major', e.target.value)}
                 aria-label="Major" className={input + ' w-full max-w-xs'} />
        </Row>
        <Row label="Parking permit">
          <select value={form.permit_type} aria-label="Parking permit"
                  onChange={(e) => set('permit_type', e.target.value as Profile['permit_type'])}
                  className={input}>
            {PERMITS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Row>
        <Row label="Noise preference">
          <label className="flex min-h-11 items-center gap-3">
            <input type="range" min={1} max={5} value={form.noise_pref}
                   onChange={(e) => set('noise_pref', Number(e.target.value))}
                   aria-label="Noise preference, 1 is quietest" className="h-6" />
            <span className="text-sm text-ink-soft">{form.noise_pref} of 5, quieter is lower</span>
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
          aria-disabled={!dirty}
          onClick={() => { if (!dirty) return; setSavedOnce(true); void saveProfile(form) }}
          className={
            'min-h-11 rounded-lg px-4 text-sm font-medium ' +
            (dirty ? 'bg-titan text-white hover:bg-titan-700' : 'cursor-not-allowed bg-rule text-ink-faint')
          }
        >
          Save changes
        </button>
        {dirty && (
          <button type="button" onClick={() => setForm(saved)}
                  className="min-h-11 px-2 text-sm font-medium text-titan hover:underline">
            Discard
          </button>
        )}
        <span role="status" className="text-xs text-ink-faint">
          {dirty ? 'Not saved yet.' : savedOnce ? 'Saved. The dashboard rescored.' : ''}
        </span>
      </div>
    </section>
  )
}

function AddClass({ buildings }: { buildings: Building[] }) {
  const [course, setCourse] = useState('')
  const [day, setDay] = useState(1)
  const [from, setFrom] = useState('09:00')
  const [to, setTo] = useState('10:15')
  const [where, setWhere] = useState(buildings[0]?.id ?? '')
  // the form is empty on arrival, so without this it greeted everyone with
  // "Give the class a course code." as though they had already done something
  // wrong. The paragraph still renders, because a live region that appears with
  // its text in it does not reliably get read out.
  const [touched, setTouched] = useState(false)
  // '' compares less than any time string, so a cleared start used to pass
  // and the class landed at midnight
  const why = !course.trim() ? 'Give the class a course code.'
    : !from || !to ? 'Both times are needed.'
    : to <= from ? 'The end time has to be after the start time.'
    : ''
  const bad = why !== ''

  function add() {
    setTouched(true)
    if (bad) return
    void addClassMeeting({
      course_code: course.trim().toUpperCase(),
      day_of_week: day,
      start_time: `${from}:00`,
      end_time: `${to}:00`,
      building_id: where,
    })
    setCourse('')
  }

  return (
    <div className="mt-3 rounded-xl border border-rule bg-paper px-4 py-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-ink-soft">
          Course
          <input id="add-course" value={course}
                 onChange={(e) => { setTouched(true); setCourse(e.target.value) }} placeholder="CPSC 362"
                 maxLength={24} className={'mt-1 block w-32 ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Day
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={'mt-1 block ' + input}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Starts
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={'mt-1 block ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Ends
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={'mt-1 block ' + input} />
        </label>
        <label className="text-xs font-medium text-ink-soft">
          Building
          <select value={where} onChange={(e) => setWhere(e.target.value)} className={'mt-1 block max-w-48 ' + input}>
            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={add}
          aria-disabled={bad}
          className={
            'min-h-11 rounded-lg px-4 text-sm font-medium ' +
            (bad ? 'cursor-not-allowed bg-rule text-ink-faint' : 'bg-titan text-white hover:bg-titan-700')
          }
        >
          Add class
        </button>
      </div>
      <p role="status" className="mt-2 min-h-4 text-xs text-flame-ink">{touched ? why : ''}</p>
    </div>
  )
}

function Week({ meetings, buildings }: { meetings: ClassMeeting[]; buildings: Building[] }) {
  const where = new Map(buildings.map((b) => [b.id, b.name]))
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
                        void removeClassMeeting(c.id)
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
      <AddClass buildings={buildings} />
    </section>
  )
}

export default function ProfileView() {
  const data = useAsync(loadProfile, [useDataVersion()])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Profile">
        What the recommendations are matched against. One profile for now, since there is no sign
        in yet, and changes last until you reload or sign out.
      </PageHeader>

      <Panel source={data}>
        {({ profile, meetings, buildings }) => (
          <>
            <Details saved={profile} />
            <Week meetings={meetings} buildings={buildings} />
          </>
        )}
      </Panel>
    </div>
  )
}
