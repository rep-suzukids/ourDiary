const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const DIARY_DATE_PATTERN = /^(20(?:2[6-9]|[3-4]\d|50))-(\d{2})-(\d{2})$/

export function localDiaryDateString() {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function isValidDiaryDate(value) {
  const match = DIARY_DATE_PATTERN.exec(value)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() + 1 === month
    && candidate.getUTCDate() === day
}

export function diaryDateFromSearch(search) {
  const requested = new URLSearchParams(search).get('date')
  return requested && isValidDiaryDate(requested) ? requested : null
}

export function formatDiaryDateLabel(value) {
  if (!isValidDiaryDate(value)) return '日付を選択してください'
  const [year, month, day] = value.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${year}年${month}月${day}日（${weekday}）`
}
