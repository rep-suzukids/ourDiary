import { useEffect, useMemo, useState } from 'react'
import { PoopIcon } from '../components/CareEventIcons.jsx'
import {
  addDate,
  childDisplayName,
  childTone,
  eventTimeLabel,
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
import { deleteBowelEvent, getBowelEvents } from '../services/bowelEventApi.js'
import '../Milk.css'
import '../Poop.css'

function initialDate() {
  const requested = new URLSearchParams(window.location.search).get('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested ?? '')
    ? requested
    : localDateString()
}

function BowelEventModal({ event, onClose, onDelete, onNavigate }) {
  useEffect(() => {
    const closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="milk-modal"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose()
      }}
    >
      <section className="milk-modal__card poop-modal__card" role="dialog" aria-modal="true" aria-labelledby="poop-detail-title">
        <button className="milk-modal__close" type="button" aria-label="閉じる" onClick={onClose}>×</button>
        <div className={`milk-modal__icon milk-event-icon--${childTone(event.childName)}`}><PoopIcon /></div>
        <p className="milk-modal__eyebrow">{eventTimeLabel(event)}の記録</p>
        <h2 id="poop-detail-title">{childDisplayName(event.childName)}のうんち</h2>
        <dl className="milk-detail-list">
          <div><dt>量</dt><dd>{bowelOptionLabel(BOWEL_AMOUNT_OPTIONS, event.amount)}</dd></div>
          <div><dt>かたさ</dt><dd>{bowelOptionLabel(BOWEL_CONSISTENCY_OPTIONS, event.consistency)}</dd></div>
          <div>
            <dt>色</dt>
            <dd className="poop-detail-color">
              <span className={`poop-color-dot poop-color-dot--${event.color}`} aria-hidden="true" />
              {bowelOptionLabel(BOWEL_COLOR_OPTIONS, event.color)}
            </dd>
          </div>
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
            <button className="milk-secondary-button milk-danger-button" type="button" onClick={() => onDelete(event)}>削除</button>
            <button
              className="milk-primary-button poop-primary-button"
              type="button"
              onClick={() => onNavigate(`/poop/edit?id=${encodeURIComponent(event.id)}&date=${event.date}`)}
            >
              編集
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function PoopPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [date, setDate] = useState(initialDate)
  const [childFilter, setChildFilter] = useState('all')
  const [children, setChildren] = useState([])
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const loadEvents = () => {
    setStatus('loading')
    setError('')
    getBowelEvents(activeFamily.id, date)
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

  const visibleEvents = useMemo(() => events.filter((event) => (
    childFilter === 'all' || event.childId === childFilter
  )), [childFilter, events])

  const changeDate = (nextDate) => {
    setDate(nextDate)
    setSelectedEvent(null)
    window.history.replaceState({}, '', `/poop?date=${nextDate}`)
  }

  const removeEvent = async (event) => {
    if (!window.confirm('このうんち記録を削除しますか？')) return
    try {
      await deleteBowelEvent(activeFamily.id, event.id)
      setSelectedEvent(null)
      loadEvents()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <main className="milk-page poop-page">
      <header className="milk-page-header">
        <a
          href={`/poop/calendar?month=${date.slice(0, 7)}`}
          onClick={navigateLink(`/poop/calendar?month=${date.slice(0, 7)}`)}
          aria-label="カレンダーへ戻る"
        >
          ←
        </a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>うんちの記録</h1>
        </div>
        <a className="milk-add-button poop-add-button" href={`/poop/new?date=${date}`} onClick={navigateLink(`/poop/new?date=${date}`)}>
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

        {status === 'loading' && <div className="milk-empty">記録を読み込んでいます…</div>}
        {status === 'error' && <div className="milk-error">{error}</div>}
        {status === 'ready' && visibleEvents.length === 0 && (
          <div className="milk-empty">
            <span aria-hidden="true">♡</span>
            <p>この日のうんち記録はまだありません。</p>
          </div>
        )}

        {status === 'ready' && visibleEvents.length > 0 && (
          <ol className="milk-timeline" aria-label={`${formatDateLabel(date)}のうんちタイムライン`}>
            {visibleEvents.map((event) => (
              <li key={event.id}>
                <time>{eventTimeLabel(event)}</time>
                <button
                  type="button"
                  className={`milk-event-icon milk-event-icon--${childTone(event.childName)}`}
                  aria-label={`${eventTimeLabel(event)}、${childDisplayName(event.childName)}のうんち。詳細を表示`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <PoopIcon />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {selectedEvent && (
        <BowelEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={removeEvent}
          onNavigate={onNavigate}
        />
      )}
    </main>
  )
}

export default PoopPage
