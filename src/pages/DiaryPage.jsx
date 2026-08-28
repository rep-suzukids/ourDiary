import { useEffect, useMemo, useState } from 'react'
import CommentSection from '../components/CommentSection.jsx'
import {
  diaryDateFromSearch,
  formatDiaryDateLabel,
  localDiaryDateString,
} from '../diaryDateUtils.js'
import {
  deleteDiaryEntry,
  getDiaryEntries,
  updateDiaryEntry,
} from '../services/diaryApi.js'
import {
  buildDiarySubjects,
  diaryEntryLabel,
  diaryEntrySubjectValue,
  diaryEntryTone,
  diarySubjectInput,
} from '../diarySubjects.js'
import '../Diary.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

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
  const [editValues, setEditValues] = useState({ subjectValue: '', date: '', text: '' })
  const [year, month] = monthValue.split('-').map(Number)
  const calendarDays = useMemo(() => buildCalendar(year, month), [month, year])
  const subjects = buildDiarySubjects(children)

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
  const createDiaryPath = `/diary/new?date=${encodeURIComponent(selectedDate)}`

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
    setEditValues({ subjectValue: diaryEntrySubjectValue(entry), date: entry.date, text: entry.text })
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    try {
      const subject = diarySubjectInput(editValues.subjectValue)
      if (!subject) throw new Error('だれについての日記か選択してください。')
      await updateDiaryEntry(activeFamily.id, {
        id: editingId,
        ...subject,
        date: editValues.date,
        text: editValues.text,
      })
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
    if (!window.confirm('この日記を削除すると、投稿されたコメントも削除されます。よろしいですか？')) return
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
          <h1>ファミリー日記</h1>
        </div>
        {canCreate && (
          <a className="diary-add-button" href={createDiaryPath} onClick={navigateLink(createDiaryPath)}>＋ 書く</a>
        )}
      </header>

      <section className="diary-calendar-card" aria-label={`${year}年${month}月の日記カレンダー`}>
        <div className="diary-calendar-toolbar">
          <span aria-hidden="true">✿</span>
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
              [diaryEntrySubjectValue(entry)]: (result[diaryEntrySubjectValue(entry)] ?? 0) + 1,
            }), {})
            return (
              <button
                type="button"
                key={key}
                className={`diary-calendar-day${selectedDate === key ? ' is-selected' : ''}${key === localDiaryDateString() ? ' is-today' : ''}`}
                onClick={() => {
                  setSelectedDate(key)
                  setEditingId('')
                }}
              >
                <span className="diary-calendar-day__number">{day}</span>
                <span className="diary-calendar-day__badges">
                  {subjects.map((subject) => counts[subject.value] ? (
                    <span key={subject.value} className={`diary-day-badge diary-day-badge--${subject.tone}`}>
                      {subject.mark}{counts[subject.value] > 1 && <small>{counts[subject.value]}</small>}
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
            <article className={`diary-note diary-note--${diaryEntryTone(entry)}`} key={entry.id}>
              {editingId === entry.id ? (
                <form className="diary-edit-form" onSubmit={saveEdit}>
                  <div className="diary-edit-row">
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
                    <select
                      value={editValues.subjectValue}
                      onChange={(event) => setEditValues((current) => ({ ...current, subjectValue: event.target.value }))}
                    >
                      {subjects.map((subject) => <option value={subject.value} key={subject.value}>{subject.name}</option>)}
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
                    <span className="diary-note__child">{diaryEntryLabel(entry)}</span>
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
              <CommentSection
                familyId={activeFamily.id}
                targetType="diary"
                targetId={entry.id}
                initialComments={entry.comments ?? []}
              />
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default DiaryPage
