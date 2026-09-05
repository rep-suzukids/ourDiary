import { useEffect, useRef, useState } from 'react'
import {
  childDisplayName,
  childTone,
  eventTimeLabel,
  formatDateLabel,
  localDateString,
  localTimeString,
  openNativePicker,
  TIME_PERIOD_OPTIONS,
} from '../careEventUtils.js'
import {
  createTimelineNote,
  getTimelineNotes,
  updateTimelineNote,
} from '../services/timelineNoteApi.js'
import '../Milk.css'
import '../Timeline.css'

function queryValue(name) {
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

function initialDate() {
  const requested = queryValue('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested)
    ? requested
    : localDateString()
}

function requestedChildTone() {
  const requested = queryValue('child')
  return requested === 'tomo' || requested === 'yuu' ? requested : ''
}

function requestedTimelineReturnPath() {
  const requested = queryValue('returnTo')
  if (!requested) return ''
  try {
    const url = new URL(requested, window.location.origin)
    return url.origin === window.location.origin && url.pathname === '/timeline'
      ? `${url.pathname}${url.search}`
      : ''
  } catch {
    return ''
  }
}

function TimelineNoteFormPage({ session, onNavigate, mode = 'create' }) {
  const activeFamily = session.families[0]
  const noteId = mode === 'edit' ? queryValue('id') : ''
  const timelineReturnPath = requestedTimelineReturnPath()
  const initialized = useRef(false)
  const [date] = useState(initialDate)
  const [children, setChildren] = useState([])
  const [child, setChild] = useState(null)
  const [timeType, setTimeType] = useState('exact')
  const [time, setTime] = useState(localTimeString)
  const [timePeriod, setTimePeriod] = useState('morning')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    getTimelineNotes(activeFamily.id, date)
      .then((result) => {
        if (!isActive || initialized.current) return
        const targetNote = mode === 'edit'
          ? result.notes.find((note) => note.id === noteId)
          : null
        if (mode === 'edit' && !targetNote) {
          throw new Error('編集するその他記録が見つかりませんでした。')
        }

        const requestedTone = requestedChildTone()
        const targetChild = mode === 'edit'
          ? result.children.find((item) => item.id === targetNote.childId)
          : result.children.find((item) => childTone(item.name) === requestedTone) ?? null
        if (mode === 'edit' && !targetChild) throw new Error('対象の子どもが見つかりませんでした。')
        if (mode === 'create' && requestedTone && !targetChild) throw new Error('対象の子どもが見つかりませんでした。')

        initialized.current = true
        setChildren(result.children)
        setChild(targetChild)
        if (targetNote) {
          setTimeType(targetNote.timeType)
          setTime(targetNote.time ?? localTimeString())
          setTimePeriod(targetNote.timePeriod ?? 'morning')
          setText(targetNote.text)
        }
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id, date, mode, noteId])

  const chooseNow = () => {
    setTime(localTimeString())
    setTimeType('exact')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedText = text.trim()
    if (!child || !normalizedText || normalizedText.length > 5000) {
      setError(child ? '本文を1文字以上5000文字以内で入力してください。' : '対象の子どもを選択してください。')
      return
    }
    if (timeType === 'period' && !timePeriod) {
      setError('だいたいの時間帯を選択してください。')
      return
    }

    setStatus('submitting')
    setError('')
    const values = {
      childId: child.id,
      date,
      timeType,
      time: timeType === 'exact' ? time : null,
      timePeriod: timeType === 'period' ? timePeriod : null,
      text: normalizedText,
    }
    try {
      if (mode === 'edit') {
        await updateTimelineNote(activeFamily.id, { id: noteId, ...values })
      } else {
        await createTimelineNote(activeFamily.id, values)
      }
      onNavigate(timelineReturnPath || `/timeline?date=${date}&child=${childTone(child.name)}`, {
        replace: mode === 'create' || Boolean(timelineReturnPath),
      })
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const backPath = timelineReturnPath || `/timeline?date=${date}&child=${child ? childTone(child.name) : requestedChildTone() || 'both'}`
  const navigateBack = (event) => {
    event.preventDefault()
    onNavigate(backPath)
  }

  const previewTime = eventTimeLabel({ timeType, time, timePeriod })

  return (
    <main className="milk-page milk-form-page timeline-note-form-page">
      <header className="milk-page-header milk-page-header--compact">
        <a href={backPath} onClick={navigateBack} aria-label="タイムラインへ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>{mode === 'edit' ? 'その他記録を編集' : 'その他を記録'}</h1>
          {child && <small>{formatDateLabel(date)}・{childDisplayName(child.name)}の記録</small>}
        </div>
      </header>

      <form className="milk-form-card" onSubmit={handleSubmit}>
        {!requestedChildTone() && mode === 'create' && (
          <fieldset className="milk-fieldset">
            <legend>どちらの子どもの記録ですか？</legend>
            <div className="milk-child-options">
              {children.map((item) => (
                <label className={`milk-child-option milk-child-option--${childTone(item.name)}${child?.id === item.id ? ' is-selected' : ''}`} key={item.id}>
                  <input type="radio" name="child" value={item.id} checked={child?.id === item.id} onChange={() => setChild(item)} />
                  <span aria-hidden="true">{childTone(item.name) === 'tomo' ? '智' : '結'}</span>
                  {childDisplayName(item.name)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="milk-fieldset">
          <legend>時間</legend>
          <button className="milk-now-button" type="button" onClick={chooseNow}>今の時刻を使う</button>
          <div className="milk-time-types">
            <label><input type="radio" name="timeType" checked={timeType === 'exact'} onChange={() => setTimeType('exact')} />時刻を指定</label>
            <label><input type="radio" name="timeType" checked={timeType === 'period'} onChange={() => setTimeType('period')} />だいたい</label>
            <label><input type="radio" name="timeType" checked={timeType === 'unknown'} onChange={() => setTimeType('unknown')} />不明</label>
          </div>
          {timeType === 'exact' && (
            <input className="milk-time-input" type="time" value={time} onClick={openNativePicker} onChange={(event) => setTime(event.target.value)} required />
          )}
          {timeType === 'period' && (
            <div className="milk-period-options">
              {TIME_PERIOD_OPTIONS.map((option) => (
                <label className={timePeriod === option.value ? 'is-selected' : ''} key={option.value}>
                  <input type="radio" name="timePeriod" value={option.value} checked={timePeriod === option.value} onChange={() => setTimePeriod(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          )}
          {timeType === 'unknown' && <p className="milk-time-note">タイムラインの「時刻不明」欄に表示します。</p>}
          <small className="timeline-note-form__time-preview">タイムライン表示：{previewTime}</small>
        </fieldset>

        <label className="milk-field">
          <span>本文</span>
          <textarea
            value={text}
            maxLength="5000"
            rows="8"
            placeholder="残しておきたいことを自由に書けます。"
            onChange={(event) => setText(event.target.value)}
            required
          />
          <small>{text.length} / 5000文字</small>
        </label>

        {error && <div className="milk-error">{error}</div>}
        <button className="milk-primary-button milk-submit-button timeline-note-primary-button" type="submit" disabled={status !== 'ready'}>
          {status === 'submitting' ? '保存中…' : mode === 'edit' ? '変更を保存する' : '記録を保存する'}
        </button>
      </form>
    </main>
  )
}

export default TimelineNoteFormPage
