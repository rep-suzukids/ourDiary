import { useEffect, useMemo, useState } from 'react'
import { ThermometerIcon } from '../components/CareEventIcons.jsx'
import {
  addDate,
  childDisplayName,
  childTone,
  eventTimeLabel,
  formatDateLabel,
  localDateString,
  openNativePicker,
} from '../careEventUtils.js'
import { deleteTemperatureEvent, getTemperatureEvents } from '../services/temperatureApi.js'
import '../Milk.css'
import '../Temperature.css'

function initialDate() {
  const requested = new URLSearchParams(window.location.search).get('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested ?? '')
    ? requested
    : localDateString()
}

function TemperatureEventModal({ event, onClose, onDelete, onNavigate }) {
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
      <section className="milk-modal__card temperature-modal__card" role="dialog" aria-modal="true" aria-labelledby="temperature-detail-title">
        <button className="milk-modal__close" type="button" aria-label="閉じる" onClick={onClose}>×</button>
        <div className={`milk-modal__icon milk-event-icon--${childTone(event.childName)}`}><ThermometerIcon /></div>
        <p className="milk-modal__eyebrow">{eventTimeLabel(event)}の記録</p>
        <h2 id="temperature-detail-title">{childDisplayName(event.childName)}の体温</h2>
        <p className={`temperature-modal__value is-${childTone(event.childName)}`}>{Number(event.temperature).toFixed(1)}<small>℃</small></p>
        <dl className="milk-detail-list">
          <div><dt>日付</dt><dd>{formatDateLabel(event.date)}</dd></div>
          <div><dt>検温時間</dt><dd>{eventTimeLabel(event)}</dd></div>
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
              className="milk-primary-button temperature-primary-button"
              type="button"
              onClick={() => onNavigate(`/temperature/edit?id=${encodeURIComponent(event.id)}&date=${event.date}`)}
            >
              編集
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function TemperaturePage({ session, onNavigate }) {
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
    getTemperatureEvents(activeFamily.id, date)
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
    window.history.replaceState({}, '', `/temperature?date=${nextDate}`)
  }

  const removeEvent = async (event) => {
    if (!window.confirm('この体温記録を削除しますか？')) return
    try {
      await deleteTemperatureEvent(activeFamily.id, event.id)
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
    <main className="milk-page temperature-page">
      <header className="milk-page-header">
        <a
          href={`/temperature/calendar?month=${date.slice(0, 7)}`}
          onClick={navigateLink(`/temperature/calendar?month=${date.slice(0, 7)}`)}
          aria-label="カレンダーへ戻る"
        >
          ←
        </a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>体温の記録</h1>
        </div>
        <a className="milk-add-button temperature-add-button" href={`/temperature/new?date=${date}`} onClick={navigateLink(`/temperature/new?date=${date}`)}>
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
            <p>この日の体温記録はまだありません。</p>
          </div>
        )}

        {status === 'ready' && visibleEvents.length > 0 && (
          <ol className="milk-timeline temperature-timeline" aria-label={`${formatDateLabel(date)}の体温タイムライン`}>
            {visibleEvents.map((event) => (
              <li key={event.id}>
                <time>{eventTimeLabel(event)}</time>
                <button
                  type="button"
                  className={`milk-event-icon milk-event-icon--${childTone(event.childName)}`}
                  aria-label={`${eventTimeLabel(event)}、${childDisplayName(event.childName)}、${Number(event.temperature).toFixed(1)}度。詳細を表示`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <ThermometerIcon />
                </button>
                <strong className={`temperature-timeline__value is-${childTone(event.childName)}`}>{Number(event.temperature).toFixed(1)}℃</strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      {selectedEvent && (
        <TemperatureEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={removeEvent}
          onNavigate={onNavigate}
        />
      )}
    </main>
  )
}

export default TemperaturePage
