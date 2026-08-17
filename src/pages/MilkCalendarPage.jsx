import { useEffect, useMemo, useState } from 'react'
import { BottleIcon, PumpIcon } from '../components/CareEventIcons.jsx'
import {
  childDisplayName,
  childTone,
  formatAmount,
  localDateString,
  openNativePicker,
} from '../careEventUtils.js'
import { getMonthlyCareSummary } from '../services/careEventApi.js'
import '../Milk.css'

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

function MilkCalendarPage({ session, onNavigate }) {
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
    getMonthlyCareSummary(activeFamily.id, year, month)
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
  const childTotals = useMemo(() => Object.fromEntries(children.map((child) => [
    child.id,
    summaries
      .filter((summary) => summary.eventType === 'feeding' && summary.childId === child.id)
      .reduce((total, summary) => total + summary.amountMl, 0),
  ])), [children, summaries])
  const pumpingTotal = useMemo(() => summaries
    .filter((summary) => summary.eventType === 'pumping')
    .reduce((total, summary) => total + summary.amountMl, 0), [summaries])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <main className="milk-page milk-calendar-page">
      <header className="milk-page-header milk-calendar-header">
        <a href="/" onClick={navigateLink('/')} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>ミルク・搾乳カレンダー</h1>
        </div>
        <a
          className="milk-add-button"
          href={`/milk/new?type=feeding&date=${monthValue === today.slice(0, 7) ? today : `${monthValue}-01`}`}
          onClick={navigateLink(`/milk/new?type=feeding&date=${monthValue === today.slice(0, 7) ? today : `${monthValue}-01`}`)}
        >
          ＋ 記録
        </a>
      </header>

      <section className="milk-calendar-card" aria-label={`${year}年${month}月のミルク・搾乳カレンダー`}>
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

        <div className="milk-calendar-summary-heading">
          <span>{year}年{month}月</span>
          <strong>今月の合計</strong>
        </div>
        <div className="milk-summary milk-calendar-summary">
          {children.map((child) => (
            <div className={`milk-summary__item milk-summary__item--${childTone(child.name)}`} key={child.id}>
              <span>{childDisplayName(child.name)}</span>
              <strong>{formatAmount(childTotals[child.id] ?? 0)}<small> mL</small></strong>
            </div>
          ))}
          <div className="milk-summary__item milk-summary__item--mother">
            <span>搾乳</span>
            <strong>{formatAmount(pumpingTotal)}<small> mL</small></strong>
          </div>
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
            const pumpingCount = daySummaries
              .filter((summary) => summary.eventType === 'pumping')
              .reduce((total, summary) => total + summary.count, 0)
            return (
              <button
                type="button"
                key={key}
                className={`milk-calendar-day${key === today ? ' is-today' : ''}`}
                aria-label={`${month}月${day}日の記録を見る`}
                onClick={() => onNavigate(`/milk?date=${key}`)}
              >
                <span className="milk-calendar-day__number">{day}</span>
                <span className="milk-calendar-day__records">
                  {children.map((child) => {
                    const count = daySummaries
                      .filter((summary) => summary.eventType === 'feeding' && summary.childId === child.id)
                      .reduce((total, summary) => total + summary.count, 0)
                    return count > 0 ? (
                      <span className={`milk-calendar-record milk-calendar-record--${childTone(child.name)}`} key={child.id}>
                        <BottleIcon />
                        <small>{count}</small>
                      </span>
                    ) : null
                  })}
                  {pumpingCount > 0 && (
                    <span className="milk-calendar-record milk-calendar-record--mother">
                      <PumpIcon />
                      <small>{pumpingCount}</small>
                    </span>
                  )}
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

export default MilkCalendarPage
