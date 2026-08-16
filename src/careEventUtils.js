export const TIME_PERIOD_OPTIONS = [
  { value: 'late_night', label: '深夜' },
  { value: 'early_morning', label: '早朝' },
  { value: 'morning', label: '朝ごろ' },
  { value: 'noon', label: '昼ごろ' },
  { value: 'evening', label: '夕方ごろ' },
  { value: 'night', label: '夜ごろ' },
]

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function jstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function localDateString(date = new Date()) {
  const value = jstParts(date)
  return `${value.year}-${value.month}-${value.day}`
}

export function localTimeString(date = new Date()) {
  const value = jstParts(date)
  return `${value.hour}:${value.minute}`
}

export function formatDateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '日付を選択してください'
  const [year, month, day] = value.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()]
  return `${year}年${month}月${day}日（${weekday}）`
}

export function addDate(value, difference) {
  const date = new Date(`${value}T12:00:00+09:00`)
  date.setUTCDate(date.getUTCDate() + difference)
  return localDateString(date)
}

export function childTone(name) {
  return name === 'ともちゃん' ? 'tomo' : 'yuu'
}

export function childDisplayName(name) {
  return name === 'ともちゃん' ? '智ちゃん' : '結ちゃん'
}

export function eventTimeLabel(event) {
  if (event.timeType === 'exact') return event.time
  if (event.timeType === 'period') {
    return TIME_PERIOD_OPTIONS.find((option) => option.value === event.timePeriod)?.label ?? 'だいたい'
  }
  return '時刻不明'
}

export function openNativePicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
}
