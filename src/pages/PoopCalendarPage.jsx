import { useEffect, useMemo, useState } from 'react'
import { PoopIcon } from '../components/CareEventIcons.jsx'
import {
  childDisplayName,
  childTone,
  localDateString,
  openNativePicker,
} from '../careEventUtils.js'
import { getMonthlyBowelSummary } from '../services/bowelEventApi.js'
import '../Milk.css'
import '../Poop.css'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function buildCalendar(year, month) {
  const cells = Array(new Date(year, month - 1, 1).getDay()).fill(null)
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function initialMonth(today) {
  const requested = new URLSearchParams(window.location.search).get('month')
  return /^20(?:2[6-9]|[3-4]\d|50)-(?:0[1-9]|1[0-2])$/.test(requested ?? '')
    ? requested
    : today.slice(0, 7)
}

function PoopCalendarPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const today = localDateString()
  const [monthValue, setMonthValue] = useState(() => initialMonth(today))
  const [children, setChildren] = useState([])
  const [summaries, setSummaries] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [year, month] = monthValue.split('-').map(Number)
  const calendarDays = useMemo(() => buildCalendar(year, month), [month, year])

  useEffect(() => {
    let isActive = true
    setStatus('loading')
    setError('')
    getMonthlyBowelSummary(activeFamily.id, year, month)
      .then((result) => {
        if (!isActive) return
        setChildren(result.children)
        setSummaries(result.summaries)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id, month, year])

  const summariesByDate = useMemo(() => summaries.reduce((grouped, summary) => {
    grouped[summary.date] = [...(grouped[summary.date] ?? []), summary]
    return grouped
  }, {}), [summaries])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }
  const initialRecordDate = monthValue === today.slice(0, 7) ? today : `${monthValue}-01`

  return (
    <main className="milk-page milk-calendar-page poop-page poop-calendar-page">
      <header className="milk-page-header milk-calendar-header">
        <a href="/" onClick={navigateLink('/')} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>うんちカレンダー</h1>
        </div>
        <a
          className="milk-add-button poop-add-button"
          href={`/poop/new?date=${initialRecordDate}`}
          onClick={navigateLink(`/poop/new?date=${initialRecordDate}`)}
        >
          ＋ 記録
        </a>
      </header>

      <section className="milk-calendar-card" aria-label={`${year}年${month}月のうんちカレンダー`}>
        <div className="milk-calendar-toolbar">
          <span aria-hidden="true">♡</span>
          <label className="milk-month-picker">
            <span className="visually-hidden">表示する年月</span>
            <input
              type="month"
              min="2026-01"
              max="2050-12"
              value={monthValue}
              onClick={openNativePicker}
              onChange={(event) => setMonthValue(event.target.value)}
            />
          </label>
          <span aria-hidden="true">♡</span>
        </div>

        {status === 'loading' && <p className="milk-calendar-status">記録を読み込んでいます…</p>}
        {status === 'error' && <div className="milk-error">{error}</div>}

        <div className="milk-calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="milk-calendar-grid">
          {calendarDays.map((day, index) => {
            if (!day) return <span className="milk-calendar-blank" key={`blank-${index}`} />
            const key = dateKey(year, month, day)
            const daySummaries = summariesByDate[key] ?? []
            return (
              <button
                type="button"
                key={key}
                className={`milk-calendar-day${key === today ? ' is-today' : ''}`}
                aria-label={`${month}月${day}日のうんち記録を見る`}
                onClick={() => onNavigate(`/poop?date=${key}`)}
              >
                <span className="milk-calendar-day__number">{day}</span>
                <span className="milk-calendar-day__records poop-calendar-day__records">
                  {children.map((child) => {
                    const count = daySummaries
                      .filter((summary) => summary.childId === child.id)
                      .reduce((total, summary) => total + summary.count, 0)
                    return count > 0 ? (
                      <span className={`milk-calendar-record milk-calendar-record--${childTone(child.name)}`} key={child.id}>
                        <PoopIcon />
                        <small>{count}</small>
                        <span className="visually-hidden">{childDisplayName(child.name)} {count}件</span>
                      </span>
                    ) : null
                  })}
                </span>
              </button>
            )
          })}
        </div>
        <p className="milk-calendar-note">日付を選ぶと、その日の記録を確認できます。</p>
      </section>
    </main>
  )
}

export default PoopCalendarPage
