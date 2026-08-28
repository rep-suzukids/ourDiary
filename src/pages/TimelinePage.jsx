import { useEffect, useMemo, useState } from 'react'
import { BottleIcon, PoopIcon } from '../components/CareEventIcons.jsx'
import {
  childDisplayName,
  childTone,
  eventTimeLabel,
  formatAmount,
  formatDateLabel,
  localDateString,
  openNativePicker,
} from '../careEventUtils.js'
import {
  BOWEL_AMOUNT_OPTIONS,
  BOWEL_COLOR_OPTIONS,
  BOWEL_CONSISTENCY_OPTIONS,
  bowelOptionLabel,
} from '../bowelEventUtils.js'
import { getBowelEvents } from '../services/bowelEventApi.js'
import { getCareEvents } from '../services/careEventApi.js'
import '../Milk.css'
import '../Poop.css'
import '../Timeline.css'

const PERIOD_ORDER = {
  late_night: 120,
  early_morning: 330,
  morning: 540,
  noon: 780,
  evening: 1020,
  night: 1290,
}

function initialDate() {
  const requested = new URLSearchParams(window.location.search).get('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested ?? '')
    ? requested
    : localDateString()
}

function initialChildTone() {
  return new URLSearchParams(window.location.search).get('child') === 'yuu' ? 'yuu' : 'tomo'
}

function eventOrder(event) {
  if (event.timeType === 'exact') {
    const [hour, minute] = event.time.split(':').map(Number)
    return hour * 60 + minute
  }
  if (event.timeType === 'period') return PERIOD_ORDER[event.timePeriod] ?? 1900
  return 2000
}

function TimelineDetailModal({ event, onClose }) {
  useEffect(() => {
    const closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const isMilk = event.recordType === 'milk'

  return (
    <div
      className="milk-modal"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <section className="milk-modal__card timeline-modal__card" role="dialog" aria-modal="true" aria-labelledby="timeline-detail-title">
        <button className="milk-modal__close" type="button" aria-label="閉じる" onClick={onClose}>×</button>
        <div className={`milk-modal__icon milk-event-icon--${childTone(event.childName)}`}>
          {isMilk ? <BottleIcon /> : <PoopIcon />}
        </div>
        <p className="milk-modal__eyebrow">{eventTimeLabel(event)}の記録</p>
        <h2 id="timeline-detail-title">{childDisplayName(event.childName)}の{isMilk ? 'ミルク' : 'うんち'}</h2>
        <dl className="milk-detail-list">
          {isMilk ? (
            <div><dt>量</dt><dd>{formatAmount(event.amountMl)} mL</dd></div>
          ) : (
            <>
              <div><dt>量</dt><dd>{bowelOptionLabel(BOWEL_AMOUNT_OPTIONS, event.amount)}</dd></div>
              <div><dt>かたさ</dt><dd>{bowelOptionLabel(BOWEL_CONSISTENCY_OPTIONS, event.consistency)}</dd></div>
              <div>
                <dt>色</dt>
                <dd className="poop-detail-color">
                  <span className={`poop-color-dot poop-color-dot--${event.color}`} aria-hidden="true" />
                  {bowelOptionLabel(BOWEL_COLOR_OPTIONS, event.color)}
                </dd>
              </div>
            </>
          )}
          <div><dt>日付</dt><dd>{formatDateLabel(event.date)}</dd></div>
          <div><dt>時刻</dt><dd>{eventTimeLabel(event)}</dd></div>
          <div><dt>記録した人</dt><dd>{event.authorName}</dd></div>
        </dl>
        <div className="milk-detail-memo">
          <span>メモ</span>
          <p>{event.memo || 'メモはありません。'}</p>
        </div>
      </section>
    </div>
  )
}

function TimelinePage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [date, setDate] = useState(initialDate)
  const [selectedTone, setSelectedTone] = useState(initialChildTone)
  const [children, setChildren] = useState([])
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    setStatus('loading')
    setError('')
    Promise.all([
      getCareEvents(activeFamily.id, date),
      getBowelEvents(activeFamily.id, date),
    ])
      .then(([careResult, bowelResult]) => {
        if (!isActive) return
        setChildren(careResult.children.length > 0 ? careResult.children : bowelResult.children)
        setEvents([
          ...careResult.events
            .filter((event) => event.eventType === 'feeding')
            .map((event) => ({ ...event, recordType: 'milk' })),
          ...bowelResult.events.map((event) => ({ ...event, recordType: 'poop' })),
        ].sort((left, right) => (
          eventOrder(left) - eventOrder(right)
          || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        )))
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id, date])

  const selectedChild = children.find((child) => childTone(child.name) === selectedTone)
  const visibleEvents = useMemo(() => events.filter((event) => (
    selectedChild && event.childId === selectedChild.id
  )), [events, selectedChild])

  const updateLocation = (nextDate, nextTone) => {
    window.history.replaceState({}, '', `/timeline?date=${nextDate}&child=${nextTone}`)
  }

  const changeDate = (nextDate) => {
    setDate(nextDate)
    setSelectedEvent(null)
    updateLocation(nextDate, selectedTone)
  }

  const changeChild = (nextTone) => {
    setSelectedTone(nextTone)
    setSelectedEvent(null)
    updateLocation(date, nextTone)
  }

  const navigateTop = (event) => {
    event.preventDefault()
    onNavigate('/')
  }

  return (
    <main className="milk-page timeline-page">
      <header className="milk-page-header timeline-page-header">
        <a href="/" onClick={navigateTop} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>タイムライン</h1>
        </div>
      </header>

      <section className="milk-dashboard timeline-dashboard">
        <label className="timeline-field">
          <span>日付</span>
          <span className="timeline-date-control">
            <span className="timeline-date-control__label" aria-hidden="true">{formatDateLabel(date)}</span>
            <input
              type="date"
              min="2026-01-01"
              max="2050-12-31"
              value={date}
              aria-label={`日付：${formatDateLabel(date)}`}
              onClick={openNativePicker}
              onChange={(event) => changeDate(event.target.value)}
            />
          </span>
        </label>

        <fieldset className="milk-fieldset timeline-child-fieldset">
          <legend>どちらの子どもの記録を見ますか？</legend>
          <div className="milk-child-options timeline-child-options">
            {children.map((child) => {
              const tone = childTone(child.name)
              return (
                <label className={`milk-child-option milk-child-option--${tone}${selectedTone === tone ? ' is-selected' : ''}`} key={child.id}>
                  <input type="radio" name="timelineChild" value={tone} checked={selectedTone === tone} onChange={() => changeChild(tone)} />
                  <span aria-hidden="true">{tone === 'tomo' ? '智' : '結'}</span>
                  {childDisplayName(child.name)}
                </label>
              )
            })}
          </div>
        </fieldset>

        {status === 'loading' && <div className="milk-empty">記録を読み込んでいます…</div>}
        {status === 'error' && <div className="milk-error">{error}</div>}
        {status === 'ready' && visibleEvents.length === 0 && (
          <div className="milk-empty">
            <span aria-hidden="true">♡</span>
            <p>この日の記録はまだありません。</p>
          </div>
        )}
        {status === 'ready' && visibleEvents.length > 0 && (
          <ol className="milk-timeline timeline-events" aria-label={`${formatDateLabel(date)}のタイムライン`}>
            {visibleEvents.map((event) => {
              const isMilk = event.recordType === 'milk'
              return (
                <li key={`${event.recordType}-${event.id}`}>
                  <time>{eventTimeLabel(event)}</time>
                  <button
                    type="button"
                    className={`milk-event-icon milk-event-icon--${childTone(event.childName)} timeline-event-icon--${event.recordType}`}
                    aria-label={`${eventTimeLabel(event)}、${childDisplayName(event.childName)}の${isMilk ? 'ミルク' : 'うんち'}。詳細を表示`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    {isMilk ? <BottleIcon /> : <PoopIcon />}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {selectedEvent && <TimelineDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </main>
  )
}

export default TimelinePage
