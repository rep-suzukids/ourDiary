import '../CalendarMonthNavigation.css'

const MIN_MONTH = '2026-01'
const MAX_MONTH = '2050-12'
const VALID_MONTH_PATTERN = /^20(?:2[6-9]|[3-4]\d|50)-(?:0[1-9]|1[0-2])$/

function shiftMonth(value, difference) {
  const [year, month] = value.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + difference, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

function CalendarMonthNavigation({ value, onChange, pickerClassName }) {
  const moveMonth = (difference) => onChange(shiftMonth(value, difference))

  return (
    <>
      <button
        className="calendar-month-navigation__button"
        type="button"
        aria-label="前月を表示"
        disabled={value <= MIN_MONTH}
        onClick={() => moveMonth(-1)}
      >
        ‹
      </button>
      <label className={pickerClassName}>
        <span className="visually-hidden">表示する年月</span>
        <input
          type="month"
          min={MIN_MONTH}
          max={MAX_MONTH}
          value={value}
          onClick={(event) => {
            if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
          }}
          onChange={(event) => {
            if (VALID_MONTH_PATTERN.test(event.target.value)) onChange(event.target.value)
          }}
        />
      </label>
      <button
        className="calendar-month-navigation__button"
        type="button"
        aria-label="翌月を表示"
        disabled={value >= MAX_MONTH}
        onClick={() => moveMonth(1)}
      >
        ›
      </button>
    </>
  )
}

export default CalendarMonthNavigation
