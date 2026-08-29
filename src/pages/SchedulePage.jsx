import { useEffect, useMemo, useState } from 'react'
import {
  diaryDateFromSearch,
  formatDiaryDateLabel,
  localDiaryDateString,
} from '../diaryDateUtils.js'
import {
  deleteSchedule,
  getSchedules,
  updateSchedule,
} from '../services/scheduleApi.js'
import '../Diary.css'
import '../Schedule.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const HTTPS_URL_PATTERN = /(https:\/\/[^\s<>"'、。！？）)\]】」』,;]+)/g

function openNativePicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
}

function normalizeDate(value) {
  return String(value).slice(0, 10)
}

function initialDate() {
  return diaryDateFromSearch(window.location.search) ?? localDiaryDateString()
}

function buildCalendar(year, month) {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = Array(firstWeekday).fill(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatWrittenAt(value) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ScheduleText({ text }) {
  return (
    <p className="schedule-entry__text">
      {text.split(HTTPS_URL_PATTERN).map((part, index) => (
        part.startsWith('https://') ? (
          <a
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            key={`${index}-${part}`}
          >
            {part}
          </a>
        ) : <span key={`${index}-${part}`}>{part}</span>
      ))}
    </p>
  )
}

function SchedulePage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const canCreate = ['parent', 'admin'].includes(activeFamily.role)
  const firstDate = initialDate()
  const [monthValue, setMonthValue] = useState(firstDate.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(firstDate)
  const [schedules, setSchedules] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editValues, setEditValues] = useState({ date: '', text: '' })
  const [year, month] = monthValue.split('-').map(Number)
  const calendarDays = useMemo(() => buildCalendar(year, month), [month, year])

  const loadSchedules = () => {
    setStatus('loading')
    setError('')
    getSchedules(activeFamily.id, year, month)
      .then((result) => {
        setSchedules((result.schedules ?? []).map((schedule) => ({
          ...schedule,
          date: normalizeDate(schedule.date),
        })))
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
  }

  useEffect(loadSchedules, [activeFamily.id, month, year])

  const schedulesByDate = useMemo(() => schedules.reduce((grouped, schedule) => {
    grouped[schedule.date] = [...(grouped[schedule.date] ?? []), schedule]
    return grouped
  }, {}), [schedules])
  const selectedSchedules = schedulesByDate[selectedDate] ?? []
  const createPath = `/schedule/new?date=${encodeURIComponent(selectedDate)}`

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const handleMonthChange = (event) => {
    const nextMonth = event.target.value
    setMonthValue(nextMonth)
    setSelectedDate(`${nextMonth}-01`)
    setEditingId('')
  }

  const startEditing = (schedule) => {
    setEditingId(schedule.id)
    setEditValues({ date: schedule.date, text: schedule.text })
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    try {
      await updateSchedule(activeFamily.id, {
        id: editingId,
        date: editValues.date,
        text: editValues.text,
      })
      setEditingId('')
      if (editValues.date.slice(0, 7) !== monthValue) {
        setMonthValue(editValues.date.slice(0, 7))
        setSelectedDate(editValues.date)
      } else {
        setSelectedDate(editValues.date)
        loadSchedules()
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const removeSchedule = async (schedule) => {
    if (!window.confirm('この予定を削除しますか？削除後は元に戻せません。')) return
    try {
      await deleteSchedule(activeFamily.id, schedule.id)
      setSchedules((current) => current.filter((item) => item.id !== schedule.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="diary-page schedule-page">
      <header className="diary-page-header">
        <a href="/" onClick={navigateLink('/')} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>家族の予定</h1>
        </div>
        {canCreate && (
          <a className="diary-add-button schedule-add-button" href={createPath} onClick={navigateLink(createPath)}>＋ 予定</a>
        )}
      </header>

      <section className="diary-calendar-card" aria-label={`${year}年${month}月の予定カレンダー`}>
        <div className="diary-calendar-toolbar schedule-calendar-toolbar">
          <span aria-hidden="true">✦</span>
          <label className="diary-month-picker">
            <span className="visually-hidden">表示する年月</span>
            <input
              type="month"
              min="2026-01"
              max="2050-12"
              value={monthValue}
              onClick={openNativePicker}
              onChange={handleMonthChange}
            />
          </label>
          <span aria-hidden="true">✦</span>
        </div>

        <div className="diary-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="diary-calendar-grid">
          {calendarDays.map((day, index) => {
            if (!day) return <span className="diary-calendar-blank" key={`blank-${index}`} />
            const key = dateKey(year, month, day)
            const count = schedulesByDate[key]?.length ?? 0
            return (
              <button
                type="button"
                key={key}
                className={`diary-calendar-day schedule-calendar-day${count > 0 ? ' has-schedules' : ''}${selectedDate === key ? ' is-selected' : ''}${key === localDiaryDateString() ? ' is-today' : ''}`}
                onClick={() => {
                  setSelectedDate(key)
                  setEditingId('')
                }}
              >
                <span className="diary-calendar-day__number">{day}</span>
                {count > 0 && (
                  <span className="schedule-day-marker" aria-label={`予定${count}件`}>
                    !{count > 1 && <small>{count}</small>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="diary-day-section schedule-day-section">
        <div className="diary-day-heading schedule-day-heading">
          <div>
            <p>{Number(selectedDate.slice(5, 7))}月{Number(selectedDate.slice(8, 10))}日</p>
            <h2>この日の予定</h2>
          </div>
          <span>{selectedSchedules.length}件</span>
        </div>

        {status === 'loading' && <p className="diary-empty">予定を読み込んでいます…</p>}
        {status === 'error' && <div className="diary-error">{error}</div>}
        {status === 'ready' && selectedSchedules.length === 0 && (
          <div className="diary-empty schedule-empty">
            <span aria-hidden="true">○</span>
            <p>この日の予定はありません。</p>
          </div>
        )}

        <div className="schedule-entries">
          {selectedSchedules.map((schedule) => (
            <article className="schedule-entry" key={schedule.id}>
              {editingId === schedule.id ? (
                <form className="diary-edit-form" onSubmit={saveEdit}>
                  <span className="diary-date-control">
                    <span className="diary-date-control__label" aria-hidden="true">
                      {formatDiaryDateLabel(editValues.date)}
                    </span>
                    <input
                      type="date"
                      min="2026-01-01"
                      max="2050-12-31"
                      value={editValues.date}
                      aria-label={`日付：${formatDiaryDateLabel(editValues.date)}`}
                      onClick={openNativePicker}
                      onChange={(event) => setEditValues((current) => ({ ...current, date: event.target.value }))}
                      required
                    />
                  </span>
                  <textarea
                    rows="6"
                    maxLength="10000"
                    value={editValues.text}
                    onChange={(event) => setEditValues((current) => ({ ...current, text: event.target.value }))}
                    required
                  />
                  <div className="diary-edit-actions">
                    <button type="button" onClick={() => setEditingId('')}>キャンセル</button>
                    <button type="submit">保存</button>
                  </div>
                </form>
              ) : (
                <>
                  <header className="schedule-entry__header">
                    <span aria-hidden="true">!</span>
                    <strong>予定</strong>
                  </header>
                  <ScheduleText text={schedule.text} />
                  <footer className="schedule-entry__footer">
                    <span>{schedule.authorName}</span>
                    <time dateTime={schedule.createdAt}>{formatWrittenAt(schedule.createdAt)}</time>
                    {schedule.canEdit && (
                      <span className="schedule-entry__actions">
                        <button type="button" aria-label="予定を編集" title="編集" onClick={() => startEditing(schedule)}>✎</button>
                        <button type="button" aria-label="予定を削除" title="削除" onClick={() => removeSchedule(schedule)}>🗑</button>
                      </span>
                    )}
                  </footer>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default SchedulePage
