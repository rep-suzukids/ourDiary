import { useEffect, useMemo, useState } from 'react'
import {
  deleteDiaryEntry,
  getDiaryEntries,
  updateDiaryEntry,
} from '../services/diaryApi.js'
import '../Diary.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function openNativePicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
}

function localDateString() {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function normalizeDate(value) {
  return String(value).slice(0, 10)
}

function initialDate() {
  const requested = new URLSearchParams(window.location.search).get('date')
  if (requested && /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested)) return requested
  return localDateString()
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

function childMark(name) {
  return name === 'ともちゃん' ? '智' : '結'
}

function DiaryPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const canCreate = ['parent', 'admin'].includes(activeFamily.role)
  const firstDate = initialDate()
  const [monthValue, setMonthValue] = useState(firstDate.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(firstDate)
  const [children, setChildren] = useState([])
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editValues, setEditValues] = useState({ childId: '', date: '', text: '' })
  const [year, month] = monthValue.split('-').map(Number)
  const calendarDays = useMemo(() => buildCalendar(year, month), [month, year])

  const loadEntries = () => {
    setStatus('loading')
    setError('')
    getDiaryEntries(activeFamily.id, year, month)
      .then((result) => {
        setChildren(result.children)
        setEntries(result.entries.map((entry) => ({ ...entry, date: normalizeDate(entry.date) })))
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
  }

  useEffect(loadEntries, [activeFamily.id, month, year])

  const entriesByDate = useMemo(() => entries.reduce((grouped, entry) => {
    grouped[entry.date] = [...(grouped[entry.date] ?? []), entry]
    return grouped
  }, {}), [entries])
  const selectedEntries = entriesByDate[selectedDate] ?? []

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

  const startEditing = (entry) => {
    setEditingId(entry.id)
    setEditValues({ childId: entry.childId, date: entry.date, text: entry.text })
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    try {
      await updateDiaryEntry(activeFamily.id, { id: editingId, ...editValues })
      setEditingId('')
      if (editValues.date.slice(0, 7) !== monthValue) {
        setMonthValue(editValues.date.slice(0, 7))
        setSelectedDate(editValues.date)
      } else {
        setSelectedDate(editValues.date)
        loadEntries()
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const removeEntry = async (entry) => {
    if (!window.confirm('この日記を削除しますか？')) return
    try {
      await deleteDiaryEntry(activeFamily.id, entry.id)
      setEntries((current) => current.filter((item) => item.id !== entry.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="diary-page">
      <header className="diary-page-header">
        <a href="/" onClick={navigateLink('/')} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>ふたりの成長日記</h1>
        </div>
        {canCreate && (
          <a className="diary-add-button" href="/diary/new" onClick={navigateLink('/diary/new')}>＋ 書く</a>
        )}
      </header>

      <section className="diary-calendar-card" aria-label={`${year}年${month}月の日記カレンダー`}>
        <div className="diary-calendar-toolbar">
          <span aria-hidden="true">✿</span>
          <label>
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
          <span aria-hidden="true">✿</span>
        </div>

        <div className="diary-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="diary-calendar-grid">
          {calendarDays.map((day, index) => {
            if (!day) return <span className="diary-calendar-blank" key={`blank-${index}`} />
            const key = dateKey(year, month, day)
            const dayEntries = entriesByDate[key] ?? []
            const counts = dayEntries.reduce((result, entry) => ({
              ...result,
              [entry.childName]: (result[entry.childName] ?? 0) + 1,
            }), {})
            return (
              <button
                type="button"
                key={key}
                className={`diary-calendar-day${selectedDate === key ? ' is-selected' : ''}${key === localDateString() ? ' is-today' : ''}`}
                onClick={() => {
                  setSelectedDate(key)
                  setEditingId('')
                }}
              >
                <span className="diary-calendar-day__number">{day}</span>
                <span className="diary-calendar-day__badges">
                  {children.map((child) => counts[child.name] ? (
                    <span key={child.id} className={`diary-day-badge diary-day-badge--${child.name === 'ともちゃん' ? 'tomo' : 'yuu'}`}>
                      {childMark(child.name)}{counts[child.name] > 1 && <small>{counts[child.name]}</small>}
                    </span>
                  ) : null)}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="diary-day-section">
        <div className="diary-day-heading">
          <div>
            <p>{Number(selectedDate.slice(5, 7))}月{Number(selectedDate.slice(8, 10))}日</p>
            <h2>この日の思い出</h2>
          </div>
          <span>{selectedEntries.length}件</span>
        </div>

        {status === 'loading' && <p className="diary-empty">日記を読み込んでいます…</p>}
        {status === 'error' && <div className="diary-error">{error}</div>}
        {status === 'ready' && selectedEntries.length === 0 && (
          <div className="diary-empty">
            <span aria-hidden="true">♡</span>
            <p>この日の日記はまだありません。</p>
          </div>
        )}

        <div className="diary-notes">
          {selectedEntries.map((entry) => (
            <article className={`diary-note diary-note--${entry.childName === 'ともちゃん' ? 'tomo' : 'yuu'}`} key={entry.id}>
              {editingId === entry.id ? (
                <form className="diary-edit-form" onSubmit={saveEdit}>
                  <div className="diary-edit-row">
                    <input
                      type="date"
                      min="2026-01-01"
                      max="2050-12-31"
                      value={editValues.date}
                      onClick={openNativePicker}
                      onChange={(event) => setEditValues((current) => ({ ...current, date: event.target.value }))}
                      required
                    />
                    <select
                      value={editValues.childId}
                      onChange={(event) => setEditValues((current) => ({ ...current, childId: event.target.value }))}
                    >
                      {children.map((child) => <option value={child.id} key={child.id}>{child.name}</option>)}
                    </select>
                  </div>
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
                  <header>
                    <span className="diary-note__child">{childMark(entry.childName)}ちゃん</span>
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleTimeString('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </header>
                  <p className="diary-note__text">{entry.text}</p>
                  <footer>
                    <span>書いた人：{entry.authorName}</span>
                    {entry.canEdit && (
                      <span className="diary-note__actions">
                        <button type="button" aria-label="日記を編集" title="編集" onClick={() => startEditing(entry)}>✎</button>
                        <button type="button" aria-label="日記を削除" title="削除" onClick={() => removeEntry(entry)}>🗑</button>
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

export default DiaryPage
