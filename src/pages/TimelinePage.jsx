import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BottleIcon,
  DiaperIcon,
  MedicationIcon,
  NoteIcon,
  ThermometerIcon,
} from '../components/CareEventIcons.jsx'
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
import {
  BOWEL_AMOUNT_OPTIONS,
  BOWEL_COLOR_OPTIONS,
  BOWEL_CONSISTENCY_OPTIONS,
  URINE_AMOUNT_OPTIONS,
  bowelOptionLabel,
} from '../bowelEventUtils.js'
import { deleteBowelEvent, getBowelEvents } from '../services/bowelEventApi.js'
import { deleteCareEvent, getCareEvents } from '../services/careEventApi.js'
import {
  deleteMedicationAdministration,
  getMedicationDay,
} from '../services/medicationApi.js'
import { deleteTemperatureEvent, getTemperatureEvents } from '../services/temperatureApi.js'
import { deleteTimelineNote, getTimelineNotes } from '../services/timelineNoteApi.js'
import {
  TIMELINE_BUCKET_MINUTES,
  TIMELINE_PREVIOUS_DAY_START_HOUR,
} from '../timelineConfig.js'
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

// 最下部の余白をすべて押し上げず、最新記録を上端のフェードより下に見せます。
const TIMELINE_LATEST_VISIBLE_OFFSET = 48

function initialDate() {
  const requested = new URLSearchParams(window.location.search).get('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested ?? '')
    ? requested
    : localDateString()
}

function initialChildTone() {
  const requested = new URLSearchParams(window.location.search).get('child')
  return requested === 'tomo' || requested === 'yuu' ? requested : 'both'
}

function eventOrder(event) {
  if (event.timeType === 'exact') {
    const [hour, minute] = event.time.split(':').map(Number)
    return hour * 60 + minute
  }
  if (event.timeType === 'period') return PERIOD_ORDER[event.timePeriod] ?? 1900
  return 2000
}

function eventBucket(event) {
  if (event.timeType === 'unknown') return 'unknown'
  let minutes = PERIOD_ORDER[event.timePeriod] ?? 0
  if (event.timeType === 'exact') {
    const [hour, minute] = event.time.split(':').map(Number)
    minutes = hour * 60 + minute
  }
  return Math.floor(minutes / TIMELINE_BUCKET_MINUTES) * TIMELINE_BUCKET_MINUTES
}

function formatClockMinutes(minutes) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function bucketLabel(bucket) {
  if (bucket === 'unknown') return '時刻不明'
  const endMinutes = Math.min(bucket + TIMELINE_BUCKET_MINUTES - 1, 24 * 60 - 1)
  return `${formatClockMinutes(bucket)}–${formatClockMinutes(endMinutes)}`
}

function timelineTimeLabel(event, selectedDate) {
  const label = eventTimeLabel(event)
  return event.date < selectedDate ? `前日 ${label}` : label
}

function timelineBucketLabel(row, selectedDate) {
  const label = bucketLabel(row.bucket)
  return row.date < selectedDate ? `前日 ${label}` : label
}

async function loadTimelineDay(familyId, date) {
  const [careResult, bowelResult, noteResult, medicationResult, temperatureResult] = await Promise.all([
    getCareEvents(familyId, date),
    getBowelEvents(familyId, date),
    getTimelineNotes(familyId, date),
    getMedicationDay(familyId, date),
    getTemperatureEvents(familyId, date),
  ])
  return { careResult, bowelResult, noteResult, medicationResult, temperatureResult }
}

function timelineEventsFromDay({ careResult, bowelResult, noteResult, medicationResult, temperatureResult }) {
  return [
    ...careResult.events
      .filter((event) => event.eventType === 'feeding')
      .map((event) => ({ ...event, recordType: 'milk' })),
    ...(careResult.nextMilkPlans ?? []).map((event) => ({
      ...event,
      id: `milk-plan-${event.childId}-${event.date}-${event.time}`,
      recordType: 'milk-plan',
      timeType: 'exact',
      createdAt: `${event.date}T${event.time}:59`,
    })),
    ...bowelResult.events.map((event) => ({ ...event, recordType: 'poop' })),
    ...noteResult.notes.map((event) => ({ ...event, recordType: 'note' })),
    ...medicationResult.administrations.map((event) => ({ ...event, recordType: 'medication' })),
    ...temperatureResult.events.map((event) => ({ ...event, recordType: 'temperature' })),
  ]
}

function TimelineRecordIcon({ event }) {
  if (event.recordType === 'milk' || event.recordType === 'milk-plan') return <BottleIcon />
  if (event.recordType === 'note') return <NoteIcon />
  if (event.recordType === 'medication') return <MedicationIcon />
  if (event.recordType === 'temperature') return <ThermometerIcon />
  return <DiaperIcon />
}

function recordLabel(event) {
  if (event.recordType === 'milk') return 'ミルク'
  if (event.recordType === 'milk-plan') return '次のミルク予定'
  if (event.recordType === 'note') return 'その他'
  if (event.recordType === 'medication') return 'おくすり'
  if (event.recordType === 'temperature') return '検温'
  return 'おむつ'
}

function TimelineDetailModal({ event, onClose, onDelete, onNavigate, returnPath }) {
  useEffect(() => {
    const closeOnEscape = (keyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const isMilk = event.recordType === 'milk'
  const isNote = event.recordType === 'note'
  const isMedication = event.recordType === 'medication'
  const isTemperature = event.recordType === 'temperature'
  const timelinePath = returnPath || `/timeline?${new URLSearchParams({
    date: event.date,
    child: childTone(event.childName),
  })}`
  const editQuery = new URLSearchParams({
    id: event.id,
    date: event.date,
    returnTo: timelinePath,
  })
  const editPath = isMilk
    ? `/milk/edit?${editQuery}`
    : isNote
      ? `/timeline/note/edit?${new URLSearchParams({
        id: event.id,
        date: event.date,
        child: childTone(event.childName),
        returnTo: timelinePath,
      })}`
      : isMedication
        ? `/medication/edit?${editQuery}`
        : isTemperature
          ? `/temperature/edit?${editQuery}`
          : `/poop/edit?${editQuery}`
  const editButtonClass = isNote
    ? 'timeline-note-primary-button'
    : isMilk
      ? ''
      : isMedication
        ? 'medication-primary-button'
        : isTemperature
          ? 'temperature-primary-button'
          : 'poop-primary-button'

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
        <div className={`milk-modal__icon milk-event-icon--${childTone(event.childName)}${isNote ? ' timeline-event-icon--note' : ''}`}>
          <TimelineRecordIcon event={event} />
        </div>
        <p className="milk-modal__eyebrow">{eventTimeLabel(event)}の記録</p>
        <h2 id="timeline-detail-title">{childDisplayName(event.childName)}の{recordLabel(event)}</h2>
        {!isNote && <dl className="milk-detail-list">
          {isMilk ? (
            <div><dt>量</dt><dd>{formatAmount(event.amountMl)} mL</dd></div>
          ) : isMedication ? (
            <div><dt>おくすり</dt><dd>{event.medicationName}</dd></div>
          ) : isTemperature ? (
            <div><dt>体温</dt><dd>{Number(event.temperature).toFixed(1)}℃</dd></div>
          ) : (
            <>
              {event.urineAmount && <div><dt>おしっこの量</dt><dd>{bowelOptionLabel(URINE_AMOUNT_OPTIONS, event.urineAmount)}</dd></div>}
              {event.amount && <>
                <div><dt>うんちの量</dt><dd>{bowelOptionLabel(BOWEL_AMOUNT_OPTIONS, event.amount)}</dd></div>
                <div><dt>かたさ</dt><dd>{bowelOptionLabel(BOWEL_CONSISTENCY_OPTIONS, event.consistency)}</dd></div>
                <div>
                  <dt>色</dt>
                  <dd className="poop-detail-color">
                    <span className={`poop-color-dot poop-color-dot--${event.color}`} aria-hidden="true" />
                    {bowelOptionLabel(BOWEL_COLOR_OPTIONS, event.color)}
                  </dd>
                </div>
              </>}
            </>
          )}
          <div><dt>日付</dt><dd>{formatDateLabel(event.date)}</dd></div>
          <div><dt>時刻</dt><dd>{eventTimeLabel(event)}</dd></div>
          <div><dt>記録した人</dt><dd>{event.authorName}</dd></div>
        </dl>}
        <div className="milk-detail-memo">
          <span>{isNote ? '本文' : 'メモ'}</span>
          <p>{isNote ? event.text : event.memo || 'メモはありません。'}</p>
        </div>
        {isNote && (
          <dl className="milk-detail-list timeline-note-detail-meta">
            <div><dt>日付</dt><dd>{formatDateLabel(event.date)}</dd></div>
            <div><dt>時刻</dt><dd>{eventTimeLabel(event)}</dd></div>
            <div><dt>記録した人</dt><dd>{event.authorName}</dd></div>
          </dl>
        )}
        {event.canEdit && (
          <div className="milk-modal__actions">
            <button className="milk-secondary-button milk-danger-button" type="button" onClick={() => onDelete(event)}>削除</button>
            <button
              className={`milk-primary-button ${editButtonClass}`.trim()}
              type="button"
              onClick={() => onNavigate(editPath)}
            >
              編集
            </button>
          </div>
        )}
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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [scrollEdges, setScrollEdges] = useState({ above: false, below: false })
  const quickAddRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    let isActive = true
    setStatus('loading')
    setError('')
    const previousDate = addDate(date, -1)
    const previousDayRequest = date > '2026-01-01'
      ? loadTimelineDay(activeFamily.id, previousDate)
      : Promise.resolve(null)
    Promise.all([
      loadTimelineDay(activeFamily.id, date),
      previousDayRequest,
    ])
      .then(([currentDay, previousDay]) => {
        if (!isActive) return
        const { careResult, bowelResult, temperatureResult } = currentDay
        setChildren(
          careResult.children.length > 0
            ? careResult.children
            : bowelResult.children.length > 0
              ? bowelResult.children
              : temperatureResult.children,
        )
        const previousEveningEvents = previousDay
          ? timelineEventsFromDay(previousDay).filter((event) => (
            eventOrder(event) >= TIMELINE_PREVIOUS_DAY_START_HOUR * 60
            && eventOrder(event) < 24 * 60
          ))
          : []
        setEvents([
          ...previousEveningEvents,
          ...timelineEventsFromDay(currentDay),
        ].sort((left, right) => (
          left.date.localeCompare(right.date)
          || eventOrder(left) - eventOrder(right)
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

  useEffect(() => {
    if (!isQuickAddOpen) return undefined

    const closeQuickAdd = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && quickAddRef.current?.contains(event.target)) return
      setIsQuickAddOpen(false)
    }

    document.addEventListener('pointerdown', closeQuickAdd)
    document.addEventListener('keydown', closeQuickAdd)
    return () => {
      document.removeEventListener('pointerdown', closeQuickAdd)
      document.removeEventListener('keydown', closeQuickAdd)
    }
  }, [isQuickAddOpen])

  const selectedChild = children.find((child) => childTone(child.name) === selectedTone)
  const visibleEvents = useMemo(() => events.filter((event) => (
    selectedTone === 'both' || (selectedChild && event.childId === selectedChild.id)
  )), [events, selectedChild, selectedTone])

  const comparisonRows = useMemo(() => {
    if (selectedTone !== 'both') return []
    const rows = new Map()
    visibleEvents.forEach((event) => {
      const bucket = eventBucket(event)
      const key = `${event.date}:${bucket}`
      if (!rows.has(key)) rows.set(key, { key, date: event.date, bucket, tomo: [], yuu: [] })
      rows.get(key)[childTone(event.childName)].push(event)
    })
    return [...rows.values()].sort((left, right) => {
      const dateOrder = left.date.localeCompare(right.date)
      if (dateOrder !== 0) return dateOrder
      if (left.bucket === 'unknown') return 1
      if (right.bucket === 'unknown') return -1
      return left.bucket - right.bucket
    })
  }, [selectedTone, visibleEvents])

  useEffect(() => {
    if (status !== 'ready') return undefined

    const animationFrame = window.requestAnimationFrame(() => {
      const scrollElement = scrollRef.current
      if (!scrollElement) return
      const bottomPadding = Number.parseFloat(window.getComputedStyle(scrollElement).paddingBottom) || 0
      const visibleOffset = Math.min(TIMELINE_LATEST_VISIBLE_OFFSET, bottomPadding)
      scrollElement.scrollTop = Math.max(
        0,
        scrollElement.scrollHeight - scrollElement.clientHeight - visibleOffset,
      )
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [date, selectedTone, status])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || status !== 'ready') {
      setScrollEdges({ above: false, below: false })
      return undefined
    }

    const updateScrollEdges = () => {
      const above = scrollElement.scrollTop > 2
      const bottomPadding = Number.parseFloat(window.getComputedStyle(scrollElement).paddingBottom) || 0
      const contentBottom = scrollElement.scrollHeight - bottomPadding
      const below = scrollElement.scrollTop + scrollElement.clientHeight < contentBottom - 2
      setScrollEdges((current) => (
        current.above === above && current.below === below ? current : { above, below }
      ))
    }

    const animationFrame = window.requestAnimationFrame(updateScrollEdges)
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updateScrollEdges)
      : null
    resizeObserver?.observe(scrollElement)
    scrollElement.addEventListener('scroll', updateScrollEdges, { passive: true })
    window.addEventListener('resize', updateScrollEdges)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      scrollElement.removeEventListener('scroll', updateScrollEdges)
      window.removeEventListener('resize', updateScrollEdges)
    }
  }, [status, visibleEvents.length])

  const updateLocation = (nextDate, nextTone) => {
    window.history.replaceState({}, '', `/timeline?date=${nextDate}&child=${nextTone}`)
  }

  const changeDate = (nextDate) => {
    setDate(nextDate)
    setSelectedEvent(null)
    setIsQuickAddOpen(false)
    updateLocation(nextDate, selectedTone)
  }

  const changeChild = (nextTone) => {
    setSelectedTone(nextTone)
    setSelectedEvent(null)
    setIsQuickAddOpen(false)
    updateLocation(date, nextTone)
  }

  const quickAddPath = (recordType) => {
    const returnTo = `/timeline?${new URLSearchParams({ date, child: selectedTone })}`
    const query = new URLSearchParams({ date, returnTo })
    if (selectedTone !== 'both') query.set('child', selectedTone)
    return `/${recordType}/new?${query}`
  }

  const navigateQuickAdd = (recordType) => (event) => {
    event.preventDefault()
    setIsQuickAddOpen(false)
    onNavigate(quickAddPath(recordType))
  }

  const navigateTop = (event) => {
    event.preventDefault()
    onNavigate('/')
  }

  const handleDeleteEvent = async (targetEvent) => {
    if (!window.confirm(`この${recordLabel(targetEvent)}記録を削除しますか？`)) return
    try {
      if (targetEvent.recordType === 'milk') {
        await deleteCareEvent(activeFamily.id, targetEvent.id)
      } else if (targetEvent.recordType === 'note') {
        await deleteTimelineNote(activeFamily.id, targetEvent.id)
      } else if (targetEvent.recordType === 'medication') {
        await deleteMedicationAdministration(activeFamily.id, targetEvent.id)
      } else if (targetEvent.recordType === 'temperature') {
        await deleteTemperatureEvent(activeFamily.id, targetEvent.id)
      } else {
        await deleteBowelEvent(activeFamily.id, targetEvent.id)
      }
      setEvents((current) => current.filter((event) => !(
        event.recordType === targetEvent.recordType && event.id === targetEvent.id
      )))
      setSelectedEvent(null)
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const scrollTimeline = (direction) => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return
    scrollElement.scrollBy({
      top: direction * Math.max(160, scrollElement.clientHeight * 0.65),
      behavior: 'smooth',
    })
  }

  const currentTimelinePath = `/timeline?${new URLSearchParams({ date, child: selectedTone })}`
  const quickAddSubject = selectedChild ? `${childDisplayName(selectedChild.name)}の` : ''

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
        <div className="timeline-field">
          <span id="timeline-date-label">日付</span>
          <div className="milk-date-nav timeline-date-nav">
            <button
              type="button"
              aria-label="前の日"
              disabled={date <= '2026-01-01'}
              onClick={() => changeDate(addDate(date, -1))}
            >
              ‹
            </button>
            <label className="timeline-date-control">
              <span className="timeline-date-control__label" aria-hidden="true">{formatDateLabel(date)}</span>
              <input
                type="date"
                min="2026-01-01"
                max="2050-12-31"
                value={date}
                aria-labelledby="timeline-date-label"
                aria-label={`日付：${formatDateLabel(date)}`}
                onClick={openNativePicker}
                onChange={(event) => changeDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              aria-label="次の日"
              disabled={date >= '2050-12-31'}
              onClick={() => changeDate(addDate(date, 1))}
            >
              ›
            </button>
          </div>
        </div>

        <fieldset className="milk-fieldset timeline-child-fieldset">
          <legend>どちらの子どもの記録を見ますか？</legend>
          <div className="milk-child-options timeline-child-options">
            <label className={`milk-child-option timeline-child-option--both${selectedTone === 'both' ? ' is-selected' : ''}`}>
              <input type="radio" name="timelineChild" value="both" checked={selectedTone === 'both'} onChange={() => changeChild('both')} />
              <span aria-hidden="true">双</span>
              ふたり
            </label>
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
            <p>前日20時以降から、この日の記録はまだありません。</p>
          </div>
        )}
        {status === 'ready' && visibleEvents.length > 0 && (
          <div className={`timeline-scroll-shell${selectedTone === 'both' ? ' is-comparison' : ''}${scrollEdges.above ? ' has-content-above' : ''}${scrollEdges.below ? ' has-content-below' : ''}`}>
            {selectedTone === 'both' && (
              <div className="timeline-comparison-header" aria-hidden="true">
                <span>時間帯</span>
                <strong>智ちゃん</strong>
                <strong>結ちゃん</strong>
              </div>
            )}
            <div ref={scrollRef} className="timeline-scroll" tabIndex="0" aria-label={`${formatDateLabel(date)}の記録一覧。前日20時以降を含みます`}>
              {selectedTone === 'both' ? (
                <div className="timeline-comparison" role="table" aria-label={`${formatDateLabel(date)}のふたりのタイムライン。前日20時以降を含みます`}>
                  {comparisonRows.map((row) => (
                    <div className="timeline-comparison-row" role="row" key={row.key}>
                      <time role="rowheader">{timelineBucketLabel(row, date)}</time>
                      {['tomo', 'yuu'].map((tone) => (
                        <div className={`timeline-comparison-cell timeline-comparison-cell--${tone}`} role="cell" key={tone}>
                          {row[tone].map((event) => {
                            if (event.recordType === 'milk-plan') {
                              return (
                                <span className="timeline-comparison-entry timeline-comparison-entry--planned" key={event.id}>
                                  <span
                                    className={`milk-event-icon milk-event-icon--${tone} timeline-event-icon--milk-plan timeline-comparison-event`}
                                    role="img"
                                    aria-label={`${timelineTimeLabel(event, date)}、${childDisplayName(event.childName)}の次のミルク予定`}
                                  >
                                    <BottleIcon />
                                  </span>
                                  <time>{timelineTimeLabel(event, date)}</time>
                                </span>
                              )
                            }
                            return (
                              <span className="timeline-comparison-entry" key={`${event.recordType}-${event.id}`}>
                                <button
                                  type="button"
                                  className={`milk-event-icon milk-event-icon--${tone} timeline-event-icon--${event.recordType} timeline-comparison-event`}
                                  aria-label={`${timelineTimeLabel(event, date)}、${childDisplayName(event.childName)}の${recordLabel(event)}。詳細を表示`}
                                  onClick={() => setSelectedEvent(event)}
                                >
                                  <TimelineRecordIcon event={event} />
                                  {event.timeType === 'period' && (
                                    <small className="timeline-comparison-event__approximate" aria-hidden="true">〜</small>
                                  )}
                                </button>
                                <time>{timelineTimeLabel(event, date)}</time>
                              </span>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="milk-timeline timeline-events" aria-label={`${formatDateLabel(date)}のタイムライン。前日20時以降を含みます`}>
              {visibleEvents.map((event) => {
                const isMilk = event.recordType === 'milk'
                const isMilkPlan = event.recordType === 'milk-plan'
                const isNote = event.recordType === 'note'
                const isMedication = event.recordType === 'medication'
                const isTemperature = event.recordType === 'temperature'
                const poopDetails = isMilk || isMilkPlan || isNote || isMedication || isTemperature ? [] : [
                  ...(event.urineAmount ? [{ label: 'おしっこ', value: bowelOptionLabel(URINE_AMOUNT_OPTIONS, event.urineAmount) }] : []),
                  ...(event.amount ? [
                    { label: 'うんち', value: bowelOptionLabel(BOWEL_AMOUNT_OPTIONS, event.amount) },
                    { label: 'かたさ', value: bowelOptionLabel(BOWEL_CONSISTENCY_OPTIONS, event.consistency) },
                    { label: '色', value: bowelOptionLabel(BOWEL_COLOR_OPTIONS, event.color) },
                  ] : []),
                ]
                const summaryLabel = isMilk
                  ? `${formatAmount(event.amountMl)}mL`
                  : isMilkPlan
                    ? '次のミルク予定'
                  : isNote
                    ? event.text
                    : isMedication
                      ? event.medicationName
                      : isTemperature
                        ? `${Number(event.temperature).toFixed(1)}℃`
                        : poopDetails.map((detail) => `${detail.label} ${detail.value}`).join('、')
                const noteCharacters = isNote ? Array.from(event.text) : []
                const noteSummary = noteCharacters.length > 40
                  ? `${noteCharacters.slice(0, 40).join('')}…`
                  : event.text
                return (
                  <li key={`${event.recordType}-${event.id}`}>
                    <time>{timelineTimeLabel(event, date)}</time>
                    {isMilkPlan ? (
                      <span
                        className={`milk-event-icon milk-event-icon--${childTone(event.childName)} timeline-event-icon--milk-plan`}
                        role="img"
                        aria-label={`${timelineTimeLabel(event, date)}、${childDisplayName(event.childName)}の次のミルク予定`}
                      >
                        <BottleIcon />
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`milk-event-icon milk-event-icon--${childTone(event.childName)} timeline-event-icon--${event.recordType}`}
                        aria-label={`${timelineTimeLabel(event, date)}、${childDisplayName(event.childName)}の${recordLabel(event)}、${summaryLabel}。詳細を表示`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <TimelineRecordIcon event={event} />
                        {event.timeType === 'period' && (
                          <small className="timeline-comparison-event__approximate" aria-hidden="true">〜</small>
                        )}
                      </button>
                    )}
                    <div className={`timeline-event-summary timeline-event-summary--${event.recordType} timeline-event-summary--${childTone(event.childName)}`}>
                      {isMilk ? (
                        <strong>{formatAmount(event.amountMl)}<small> mL</small></strong>
                      ) : isMilkPlan ? (
                        <strong className="timeline-event-summary__milk-plan">次のミルク予定</strong>
                      ) : isNote ? (
                        <button className="timeline-event-summary__note" type="button" title={event.text} onClick={() => setSelectedEvent(event)}>
                          {noteSummary}
                        </button>
                      ) : isMedication ? (
                        <strong className="timeline-event-summary__medication">{event.medicationName}</strong>
                      ) : isTemperature ? (
                        <strong className="timeline-event-summary__temperature">
                          {Number(event.temperature).toFixed(1)}<small>℃</small>
                        </strong>
                      ) : (
                        <div className="timeline-event-summary__choices" aria-label={`おむつ内容：${summaryLabel}`}>
                          {poopDetails.map((detail) => (
                            <span key={detail.label}><small>{detail.label}</small>{detail.value}</span>
                          ))}
                        </div>
                      )}
                      {!isMilk && !isMilkPlan && !isNote && !isMedication && !isTemperature && event.memo && (
                        <p title={event.memo}>{event.memo}</p>
                      )}
                    </div>
                  </li>
                )
              })}
                </ol>
              )}
            </div>
            {scrollEdges.above && (
              <button className="timeline-scroll-hint timeline-scroll-hint--up" type="button" onClick={() => scrollTimeline(-1)}>
                <span aria-hidden="true">↑</span> 上にもあります
              </button>
            )}
            {scrollEdges.below && (
              <button className="timeline-scroll-hint timeline-scroll-hint--down" type="button" onClick={() => scrollTimeline(1)}>
                <span aria-hidden="true">↓</span> 続きがあります
              </button>
            )}
          </div>
        )}
      </section>

      <nav
        ref={quickAddRef}
        className={`timeline-quick-add${isQuickAddOpen ? ' is-open' : ''}`}
        aria-label="育児記録を追加"
      >
        <a
          className="timeline-quick-add__item timeline-quick-add__item--milk"
          href={quickAddPath('milk')}
          onClick={navigateQuickAdd('milk')}
          aria-label={`${quickAddSubject}ミルクを記録`}
          aria-hidden={!isQuickAddOpen}
          tabIndex={isQuickAddOpen ? 0 : -1}
        >
          <BottleIcon />
          <span>ミルク</span>
        </a>
        <a
          className="timeline-quick-add__item timeline-quick-add__item--poop"
          href={quickAddPath('poop')}
          onClick={navigateQuickAdd('poop')}
          aria-label={`${quickAddSubject}おむつを記録`}
          aria-hidden={!isQuickAddOpen}
          tabIndex={isQuickAddOpen ? 0 : -1}
        >
          <DiaperIcon />
          <span>おむつ</span>
        </a>
        <a
          className="timeline-quick-add__item timeline-quick-add__item--temperature"
          href={quickAddPath('temperature')}
          onClick={navigateQuickAdd('temperature')}
          aria-label={`${quickAddSubject}検温を記録`}
          aria-hidden={!isQuickAddOpen}
          tabIndex={isQuickAddOpen ? 0 : -1}
        >
          <ThermometerIcon />
          <span>検温</span>
        </a>
        <a
          className="timeline-quick-add__item timeline-quick-add__item--medication"
          href={quickAddPath('medication')}
          onClick={navigateQuickAdd('medication')}
          aria-label={`${quickAddSubject}おくすりを記録`}
          aria-hidden={!isQuickAddOpen}
          tabIndex={isQuickAddOpen ? 0 : -1}
        >
          <MedicationIcon />
          <span>おくすり</span>
        </a>
        <a
          className="timeline-quick-add__item timeline-quick-add__item--note"
          href={quickAddPath('timeline/note')}
          onClick={navigateQuickAdd('timeline/note')}
          aria-label={`${quickAddSubject}その他を記録`}
          aria-hidden={!isQuickAddOpen}
          tabIndex={isQuickAddOpen ? 0 : -1}
        >
          <NoteIcon />
          <span>その他</span>
        </a>
        <button
          className="timeline-quick-add__toggle"
          type="button"
          aria-label={isQuickAddOpen ? '記録追加メニューを閉じる' : '記録を追加'}
          aria-expanded={isQuickAddOpen}
          disabled={children.length === 0 || status !== 'ready'}
          onClick={() => setIsQuickAddOpen((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </nav>

      {selectedEvent && (
        <TimelineDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
          onNavigate={onNavigate}
          returnPath={currentTimelinePath}
        />
      )}
    </main>
  )
}

export default TimelinePage
