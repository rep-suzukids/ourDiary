import { useEffect, useMemo, useState } from 'react'
import { deleteCareEvent, getCareEvents } from '../services/careEventApi.js'
import {
  addDate,
  childDisplayName,
  childTone,
  eventTimeLabel,
  formatAmount,
  formatDateLabel,
  localDateString,
  openNativePicker,
} from '../careEventUtils.js'
import '../Milk.css'

function BottleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M18 5h12v6l4 5v23a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V16l4-5V5Z" />
      <path d="M17 20h14M17 27h9M17 34h14" />
    </svg>
  )
}

function PumpIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 5c7 10 12 16 12 24a12 12 0 0 1-24 0c0-8 5-14 12-24Z" />
      <path d="M18 31c1.5 3.2 4 4.8 7.5 4.8" />
    </svg>
  )
}

function initialDate() {
  const requested = new URLSearchParams(window.location.search).get('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested ?? '')
    ? requested
    : localDateString()
}

function initialTab() {
  return new URLSearchParams(window.location.search).get('tab') === 'pumping'
    ? 'pumping'
    : 'feeding'
}

function EventModal({ event, onClose, onDelete, onNavigate }) {
  useEffect(() => {
    const closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const subject = event.eventType === 'pumping'
    ? 'ママ'
    : childDisplayName(event.childName)
  const typeLabel = event.eventType === 'pumping' ? '搾乳' : 'ミルク'

  return (
    <div
      className="milk-modal"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <section className="milk-modal__card" role="dialog" aria-modal="true" aria-labelledby="milk-detail-title">
        <button className="milk-modal__close" type="button" aria-label="閉じる" onClick={onClose}>×</button>
        <div className={`milk-modal__icon milk-event-icon--${event.eventType === 'pumping' ? 'mother' : childTone(event.childName)}`}>
          {event.eventType === 'pumping' ? <PumpIcon /> : <BottleIcon />}
        </div>
        <p className="milk-modal__eyebrow">{eventTimeLabel(event)}の記録</p>
        <h2 id="milk-detail-title">{subject}の{typeLabel}</h2>
        <dl className="milk-detail-list">
          <div><dt>量</dt><dd>{formatAmount(event.amountMl)} mL</dd></div>
          <div><dt>日付</dt><dd>{formatDateLabel(event.date)}</dd></div>
          <div><dt>時刻</dt><dd>{eventTimeLabel(event)}</dd></div>
          <div><dt>記録した人</dt><dd>{event.authorName}</dd></div>
        </dl>
        <div className="milk-detail-memo">
          <span>メモ</span>
          <p>{event.memo || 'メモはありません。'}</p>
        </div>
        {event.canEdit && (
          <div className="milk-modal__actions">
            <button className="milk-secondary-button milk-danger-button" type="button" onClick={() => onDelete(event)}>
              削除
            </button>
            <button
              className="milk-primary-button"
              type="button"
              onClick={() => onNavigate(`/milk/edit?id=${encodeURIComponent(event.id)}&date=${event.date}`)}
            >
              編集
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function MilkPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [date, setDate] = useState(initialDate)
  const [tab, setTab] = useState(initialTab)
  const [childFilter, setChildFilter] = useState('all')
  const [children, setChildren] = useState([])
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const loadEvents = () => {
    setStatus('loading')
    setError('')
    getCareEvents(activeFamily.id, date)
      .then((result) => {
        setChildren(result.children)
        setEvents(result.events)
        setStatus('ready')
      })
      .catch((requestError) => {
        setError(requestError.message)
        setStatus('error')
      })
  }

  useEffect(loadEvents, [activeFamily.id, date])

  const visibleEvents = useMemo(() => events.filter((event) => {
    if (event.eventType !== tab) return false
    return tab === 'pumping' || childFilter === 'all' || event.childId === childFilter
  }), [childFilter, events, tab])

  const childTotals = useMemo(() => Object.fromEntries(children.map((child) => [
    child.id,
    events
      .filter((event) => event.eventType === 'feeding' && event.childId === child.id)
      .reduce((total, event) => total + event.amountMl, 0),
  ])), [children, events])
  const pumpingTotal = useMemo(() => events
    .filter((event) => event.eventType === 'pumping')
    .reduce((total, event) => total + event.amountMl, 0), [events])

  const updateLocation = (nextDate, nextTab = tab) => {
    window.history.replaceState({}, '', `/milk?date=${nextDate}&tab=${nextTab}`)
  }

  const changeDate = (nextDate) => {
    setDate(nextDate)
    setSelectedEvent(null)
    updateLocation(nextDate)
  }

  const changeTab = (nextTab) => {
    setTab(nextTab)
    setSelectedEvent(null)
    updateLocation(date, nextTab)
  }

  const removeEvent = async (event) => {
    if (!window.confirm('この記録を削除しますか？')) return
    try {
      await deleteCareEvent(activeFamily.id, event.id)
      setSelectedEvent(null)
      setEvents((current) => current.filter((item) => item.id !== event.id))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <main className="milk-page">
      <header className="milk-page-header">
        <a href="/" onClick={navigateLink('/')} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>ミルクの記録</h1>
        </div>
        <a
          className="milk-add-button"
          href={`/milk/new?type=${tab}&date=${date}`}
          onClick={navigateLink(`/milk/new?type=${tab}&date=${date}`)}
        >
          ＋ 記録
        </a>
      </header>

      <section className="milk-dashboard">
        <div className="milk-date-nav">
          <button type="button" aria-label="前の日" onClick={() => changeDate(addDate(date, -1))}>‹</button>
          <label>
            <span className="visually-hidden">表示する日付</span>
            <span aria-hidden="true">{formatDateLabel(date)}</span>
            <input
              type="date"
              min="2026-01-01"
              max="2050-12-31"
              value={date}
              onClick={openNativePicker}
              onChange={(event) => changeDate(event.target.value)}
            />
          </label>
          <button type="button" aria-label="次の日" onClick={() => changeDate(addDate(date, 1))}>›</button>
        </div>

        <div className="milk-summary" aria-label="この日の合計">
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

        <div className="milk-tabs" role="tablist" aria-label="記録の種類">
          <button type="button" role="tab" aria-selected={tab === 'feeding'} className={tab === 'feeding' ? 'is-active' : ''} onClick={() => changeTab('feeding')}>
            子どもの記録
          </button>
          <button type="button" role="tab" aria-selected={tab === 'pumping'} className={tab === 'pumping' ? 'is-active' : ''} onClick={() => changeTab('pumping')}>
            搾乳記録
          </button>
        </div>

        {tab === 'feeding' && (
          <div className="milk-child-filters" aria-label="子どもで絞り込み">
            <button type="button" className={childFilter === 'all' ? 'is-active' : ''} onClick={() => setChildFilter('all')}>ふたり</button>
            {children.map((child) => (
              <button
                type="button"
                key={child.id}
                className={`${childFilter === child.id ? 'is-active ' : ''}is-${childTone(child.name)}`}
                onClick={() => setChildFilter(child.id)}
              >
                {childDisplayName(child.name)}
              </button>
            ))}
          </div>
        )}

        {status === 'loading' && <div className="milk-empty">記録を読み込んでいます…</div>}
        {status === 'error' && <div className="milk-error">{error}</div>}
        {status === 'ready' && visibleEvents.length === 0 && (
          <div className="milk-empty">
            <span aria-hidden="true">♡</span>
            <p>{tab === 'feeding' ? 'この日のミルク記録はまだありません。' : 'この日の搾乳記録はまだありません。'}</p>
          </div>
        )}

        {status === 'ready' && visibleEvents.length > 0 && (
          <ol className="milk-timeline" aria-label={`${formatDateLabel(date)}のタイムライン`}>
            {visibleEvents.map((event) => {
              const subject = event.eventType === 'pumping' ? 'ママ' : childDisplayName(event.childName)
              const typeLabel = event.eventType === 'pumping' ? '搾乳' : 'ミルク'
              const tone = event.eventType === 'pumping' ? 'mother' : childTone(event.childName)
              return (
                <li key={event.id}>
                  <time>{eventTimeLabel(event)}</time>
                  <button
                    type="button"
                    className={`milk-event-icon milk-event-icon--${tone}`}
                    aria-label={`${eventTimeLabel(event)}、${subject}、${typeLabel}${formatAmount(event.amountMl)}mL。詳細を表示`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    {event.eventType === 'pumping' ? <PumpIcon /> : <BottleIcon />}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={removeEvent}
          onNavigate={onNavigate}
        />
      )}
    </main>
  )
}

export default MilkPage
