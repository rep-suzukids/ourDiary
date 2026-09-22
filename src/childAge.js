const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

function dateParts(value) {
  if (!DATE_PATTERN.test(value ?? '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null
  return { year, month, day }
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function calculateChildAge(birthDate, today) {
  const birth = dateParts(birthDate)
  const current = dateParts(today)
  if (!birth || !current) return null

  const birthUtc = Date.UTC(birth.year, birth.month - 1, birth.day)
  const currentUtc = Date.UTC(current.year, current.month - 1, current.day)
  if (currentUtc < birthUtc) return null

  let totalMonths = (current.year - birth.year) * 12 + current.month - birth.month
  const anniversaryDay = Math.min(birth.day, daysInMonth(current.year, current.month))
  if (current.day < anniversaryDay) totalMonths -= 1

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: Math.floor((currentUtc - birthUtc) / MILLISECONDS_PER_DAY),
  }
}
