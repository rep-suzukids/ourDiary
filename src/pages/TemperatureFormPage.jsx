import { useEffect, useRef, useState } from 'react'
import {
  childDisplayName,
  childTone,
  formatDateLabel,
  localDateString,
  localTimeString,
  openNativePicker,
  TIME_PERIOD_OPTIONS,
} from '../careEventUtils.js'
import {
  createTemperatureEvent,
  getTemperatureEvents,
  updateTemperatureEvent,
} from '../services/temperatureApi.js'
import '../Milk.css'
import '../Temperature.css'

const DEFAULT_TEMPERATURE = '36.5'
const MIN_TEMPERATURE = 30
const MAX_TEMPERATURE = 45

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

function formattedTemperature(value) {
  if (String(value).trim() === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return value
  return number.toFixed(1)
}

function TemperatureFormPage({ session, onNavigate, mode = 'create' }) {
  const activeFamily = session.families[0]
  const eventId = mode === 'edit' ? queryValue('id') : ''
  const initializedEdit = useRef(false)
  const initializedCreate = useRef(false)
  const [children, setChildren] = useState([])
  const [latestTemperatures, setLatestTemperatures] = useState([])
  const [childId, setChildId] = useState('')
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE)
  const [date, setDate] = useState(initialDate)
  const [timeType, setTimeType] = useState('exact')
  const [time, setTime] = useState(localTimeString)
  const [timePeriod, setTimePeriod] = useState('morning')
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState(mode === 'edit' ? 'loading' : 'ready')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    getTemperatureEvents(activeFamily.id, date)
      .then((result) => {
        if (!isActive) return
        setChildren(result.children)
        setLatestTemperatures(result.latestTemperatures ?? [])

        if (mode === 'create' && !initializedCreate.current) {
          const requestedTone = requestedChildTone()
          const requestedChild = result.children.find((child) => childTone(child.name) === requestedTone)
          if (requestedChild) {
            setChildId(requestedChild.id)
            const previous = result.latestTemperatures?.find((item) => item.childId === requestedChild.id)
            setTemperature(previous?.temperature ?? DEFAULT_TEMPERATURE)
          }
          initializedCreate.current = true
        }

        if (mode === 'edit' && !initializedEdit.current) {
          const target = result.events.find((event) => event.id === eventId)
          if (!target) throw new Error('編集する記録が見つかりませんでした。')
          initializedEdit.current = true
          setChildId(target.childId)
          setTemperature(target.temperature)
          setDate(target.date)
          setTimeType(target.timeType)
          setTime(target.time ?? localTimeString())
          setTimePeriod(target.timePeriod ?? 'morning')
          setMemo(target.memo)
        }
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id, date, eventId, mode])

  const chooseChild = (nextChildId) => {
    setChildId(nextChildId)
    if (mode === 'create') {
      const previous = latestTemperatures.find((item) => item.childId === nextChildId)
      setTemperature(previous?.temperature ?? DEFAULT_TEMPERATURE)
    }
  }

  const adjustTemperature = (difference) => {
    const current = Number(temperature)
    const base = temperature !== '' && Number.isFinite(current) ? current : Number(DEFAULT_TEMPERATURE)
    const adjusted = Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, base + difference))
    setTemperature(adjusted.toFixed(1))
  }

  const chooseNow = () => {
    setDate(localDateString())
    setTime(localTimeString())
    setTimeType('exact')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!childId) {
      setError('対象の子どもを選択してください。')
      return
    }
    const temperatureNumber = Number(temperature)
    if (!Number.isFinite(temperatureNumber) || temperatureNumber < MIN_TEMPERATURE || temperatureNumber > MAX_TEMPERATURE) {
      setError('体温は30.0℃から45.0℃の範囲で入力してください。')
      return
    }
    if (timeType === 'period' && !timePeriod) {
      setError('だいたいの時間帯を選択してください。')
      return
    }

    setStatus('submitting')
    setError('')
    const values = {
      childId,
      temperature: temperatureNumber.toFixed(1),
      date,
      timeType,
      time: timeType === 'exact' ? time : null,
      timePeriod: timeType === 'period' ? timePeriod : null,
      memo,
    }
    try {
      if (mode === 'edit') {
        await updateTemperatureEvent(activeFamily.id, { id: eventId, ...values })
      } else {
        await createTemperatureEvent(activeFamily.id, values)
      }
      onNavigate(`/temperature?date=${date}`, { replace: mode === 'create' })
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }
  const selectedPrevious = latestTemperatures.find((item) => item.childId === childId)

  return (
    <main className="milk-page milk-form-page temperature-page temperature-form-page">
      <header className="milk-page-header milk-page-header--compact">
        <a href={`/temperature?date=${date}`} onClick={navigateLink(`/temperature?date=${date}`)} aria-label="体温の記録へ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>{mode === 'edit' ? '体温記録を編集' : '体温を記録'}</h1>
        </div>
      </header>

      <form className="milk-form-card" onSubmit={handleSubmit}>
        <fieldset className="milk-fieldset">
          <legend>どちらの子どもの記録ですか？</legend>
          <div className="milk-child-options">
            {children.map((child) => (
              <label className={`milk-child-option milk-child-option--${childTone(child.name)}${childId === child.id ? ' is-selected' : ''}`} key={child.id}>
                <input type="radio" name="child" value={child.id} checked={childId === child.id} onChange={() => chooseChild(child.id)} />
                <span aria-hidden="true">{child.name === 'ともちゃん' ? '智' : '結'}</span>
                {childDisplayName(child.name)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="milk-field temperature-field">
          <label htmlFor="temperature-input">体温</label>
          <span className="temperature-control">
            <button type="button" aria-label="体温を0.1度下げる" onClick={() => adjustTemperature(-0.1)}>−</button>
            <span className="temperature-control__input">
              <input
                type="number"
                id="temperature-input"
                inputMode="decimal"
                min={MIN_TEMPERATURE}
                max={MAX_TEMPERATURE}
                step="0.1"
                value={temperature}
                aria-label="体温"
                onChange={(event) => setTemperature(event.target.value)}
                onBlur={() => setTemperature((current) => formattedTemperature(current))}
                required
              />
              <strong>℃</strong>
            </span>
            <button type="button" aria-label="体温を0.1度上げる" onClick={() => adjustTemperature(0.1)}>＋</button>
          </span>
          {childId && mode === 'create' && (
            <small className="temperature-previous-note">
              {selectedPrevious
                ? `前回の${Number(selectedPrevious.temperature).toFixed(1)}℃を初期表示しています。`
                : '初回のため36.5℃から調整できます。'}
            </small>
          )}
        </div>

        <label className="milk-field">
          <span>日付</span>
          <span className="milk-date-control">
            <span className="milk-date-control__label" aria-hidden="true">{formatDateLabel(date)}</span>
            <input
              type="date"
              min="2026-01-01"
              max="2050-12-31"
              value={date}
              aria-label={`日付：${formatDateLabel(date)}`}
              onClick={openNativePicker}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </span>
        </label>

        <fieldset className="milk-fieldset">
          <legend>検温時間</legend>
          <button className="milk-now-button" type="button" onClick={chooseNow}>今の日時を使う</button>
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
                <button type="button" className={timePeriod === option.value ? 'is-selected' : ''} key={option.value} onClick={() => setTimePeriod(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {timeType === 'unknown' && <p className="milk-time-note">時刻不明の記録として表示します。</p>}
        </fieldset>

        <label className="milk-field">
          <span>フリーメモ</span>
          <textarea rows="5" maxLength="5000" value={memo} placeholder="体調や測った状況など、気になったことを自由に残せます。" onChange={(event) => setMemo(event.target.value)} />
        </label>

        {error && <div className="milk-error">{error}</div>}
        <button className="milk-primary-button milk-submit-button temperature-primary-button" type="submit" disabled={status === 'loading' || status === 'submitting' || status === 'error'}>
          {status === 'submitting' ? '保存しています…' : mode === 'edit' ? '変更を保存' : '記録を保存'}
        </button>
      </form>
    </main>
  )
}

export default TemperatureFormPage
