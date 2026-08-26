const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/

function validDateParts(year, month, day) {
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() + 1 === month
    && candidate.getUTCDate() === day
}

export function formatPhotoCapturedDate(capturedAt, capturedOn) {
  const dateTimeMatch = typeof capturedAt === 'string'
    ? DATE_TIME_PATTERN.exec(capturedAt.trim())
    : null
  if (dateTimeMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText] = dateTimeMatch
    const [year, month, day, hour, minute] = [
      yearText,
      monthText,
      dayText,
      hourText,
      minuteText,
    ].map(Number)
    if (validDateParts(year, month, day) && hour <= 23 && minute <= 59) {
      return {
        dateTime: `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}`,
        label: `${year}年${month}月${day}日 ${hourText}:${minuteText}`,
      }
    }
  }

  const dateMatch = typeof capturedOn === 'string' ? DATE_PATTERN.exec(capturedOn.trim()) : null
  if (!dateMatch) return null
  const [, yearText, monthText, dayText] = dateMatch
  const [year, month, day] = [yearText, monthText, dayText].map(Number)
  if (!validDateParts(year, month, day)) return null
  return {
    dateTime: `${yearText}-${monthText}-${dayText}`,
    label: `${year}年${month}月${day}日`,
  }
}
