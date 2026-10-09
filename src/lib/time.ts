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

export function campusDate(when: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(when)
}
