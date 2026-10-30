// Campus time in one place. Several components were each declaring the timezone
// and their own weekday list, which is how two screens ended up printing the
// same event as "Sun 13:00" and "Sun, Oct 4, 1:00 PM".
export const CAMPUS_TZ = 'America/Los_Angeles'

export const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
]

// a lot is treated as full at this point, and the bar turns orange
export const BUSY_PERCENT = 85

// handles both "09:00" and the "09:00:00" the database returns
export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

// Outside the function, because constructing one of these costs far more than
// formatting with it and the options never change. UpcomingEvents calls
// campusDate once per event to work out which ones are today, so it was paying
// for a new formatter every row.
const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

export function campusDate(when: Date) {
  return DAY_FORMAT.format(when)
}

// Every clock time a student reads goes through here. The app printed 24 hour
// times everywhere, and "be at lot by 8:31" gave no way to tell morning from
// evening: nobody at CSUF says 20:31 out loud. The database still stores
// "HH:MM:SS" and the scorer still answers "HH:MM", because 24 hour is the
// right thing to compare and sort on. This is the one place it turns into
// something a person reads, so the schedule, the arrive by times, the events
// and the dashboard cannot drift apart.
//
// It is not the only 12 hour text in the app. The hours_note on each spot row
// is CSUF's own published wording ("Mon to Thu 7am to 5pm") and is deliberately
// left as it was written, so do not come back and unify the two: rewriting
// those 24 strings to this style makes them about 40 percent longer and pushes
// most of them onto a second line.
export function clockText(value: string) {
  const [h, m] = value.split(':')
  // en-US with hour12 false can hand back "24" for midnight, which is why
  // recommend.ts carries its own % 24 guards. Nothing reaches here that way
  // today, but calling midnight the afternoon is a bad way to find out.
  const hour = Number(h) % 24
  const minute = Number(m)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value
  const suffix = hour < 12 ? 'AM' : 'PM'
  // 0 is 12 AM and 12 is 12 PM, and both come out of the modulo as 0
  const shown = hour % 12 === 0 ? 12 : hour % 12
  return `${shown}:${String(minute).padStart(2, '0')} ${suffix}`
}
