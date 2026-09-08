export const WEEKDAY_OPTIONS = [
  { value: 0, label: '日' },
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
]

export function weekdaySummary(weekdays) {
  const selected = new Set(weekdays)
  if (selected.size === 7) return '毎日'
  return WEEKDAY_OPTIONS
    .filter((option) => selected.has(option.value))
    .map((option) => `${option.label}曜`)
    .join('・')
}
