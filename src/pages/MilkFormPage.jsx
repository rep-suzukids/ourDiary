import { useEffect, useRef, useState } from 'react'
import { createCareEvent, getCareEvents, updateCareEvent } from '../services/careEventApi.js'
import {
  childDisplayName,
  childTone,
  formatDateLabel,
  formatAmount,
  localDateString,
  localTimeString,
  openNativePicker,
  TIME_PERIOD_OPTIONS,
} from '../careEventUtils.js'
import '../Milk.css'

function queryValue(name) {
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

function initialDate() {
  const requested = queryValue('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested)
    ? requested
    : localDateString()
}

function initialType() {
  return queryValue('type') === 'pumping' ? 'pumping' : 'feeding'
}

function MilkFormPage({ session, onNavigate, mode = 'create' }) {
  const activeFamily = session.families[0]
  const eventId = mode === 'edit' ? queryValue('id') : ''
  const initializedEdit = useRef(false)
  const [children, setChildren] = useState([])
  const [recentAmounts, setRecentAmounts] = useState({ pumping: [], children: {} })
  const [eventType, setEventType] = useState(initialType)
  const [childId, setChildId] = useState('')
  const [amountMl, setAmountMl] = useState('')
  const [date, setDate] = useState(initialDate)
  const [timeType, setTimeType] = useState('exact')
  const [time, setTime] = useState(localTimeString)
  const [timePeriod, setTimePeriod] = useState('morning')
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState(mode === 'edit' ? 'loading' : 'ready')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    getCareEvents(activeFamily.id, date)
      .then((result) => {
        if (!isActive) return
        setChildren(result.children)
        setRecentAmounts(result.recentAmounts)
        if (mode === 'edit' && !initializedEdit.current) {
          const target = result.events.find((event) => event.id === eventId)
          if (!target) throw new Error('編集する記録が見つかりませんでした。')
          initializedEdit.current = true
          setEventType(target.eventType)
          setChildId(target.childId ?? '')
          setAmountMl(String(target.amountMl))
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

  const amountSuggestions = eventType === 'pumping'
    ? recentAmounts.pumping
    : recentAmounts.children[childId] ?? []

  const chooseNow = () => {
    setDate(localDateString())
    setTime(localTimeString())
    setTimeType('exact')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (eventType === 'feeding' && !childId) {
      setError('対象の子どもを選択してください。')
      return
    }
    const numericAmount = Number(amountMl)
    if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(amountMl) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 2000) {
      setError('量は0より大きい2000mL以下の値を、小数第2位までで入力してください。')
      return
    }
    if (timeType === 'period' && !timePeriod) {
      setError('だいたいの時間帯を選択してください。')
      return
    }

    setStatus('submitting')
    setError('')
    const values = {
      eventType,
      childId: eventType === 'feeding' ? childId : null,
      amountMl: numericAmount,
      date,
      timeType,
      time: timeType === 'exact' ? time : null,
      timePeriod: timeType === 'period' ? timePeriod : null,
      memo,
    }
    try {
      if (mode === 'edit') {
        await updateCareEvent(activeFamily.id, { id: eventId, ...values })
      } else {
        await createCareEvent(activeFamily.id, values)
      }
      onNavigate(`/milk?date=${date}&tab=${eventType}`)
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <main className="milk-page milk-form-page">
      <header className="milk-page-header milk-page-header--compact">
        <a href={`/milk?date=${date}&tab=${eventType}`} onClick={navigateLink(`/milk?date=${date}&tab=${eventType}`)} aria-label="ミルクの記録へ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>{mode === 'edit' ? '記録を編集' : 'ミルクを記録'}</h1>
        </div>
      </header>

      <form className="milk-form-card" onSubmit={handleSubmit}>
        <fieldset className="milk-fieldset">
          <legend>何を記録しますか？</legend>
          <div className="milk-type-options">
            <label className={eventType === 'feeding' ? 'is-selected' : ''}>
              <input type="radio" name="eventType" value="feeding" checked={eventType === 'feeding'} onChange={() => setEventType('feeding')} />
              ミルクを飲んだ
            </label>
            <label className={eventType === 'pumping' ? 'is-selected' : ''}>
              <input type="radio" name="eventType" value="pumping" checked={eventType === 'pumping'} onChange={() => setEventType('pumping')} />
              搾乳した
            </label>
          </div>
        </fieldset>

        {eventType === 'feeding' ? (
          <fieldset className="milk-fieldset">
            <legend>どちらの子どもの記録ですか？</legend>
            <div className="milk-child-options">
              {children.map((child) => (
                <label className={`milk-child-option milk-child-option--${childTone(child.name)}${childId === child.id ? ' is-selected' : ''}`} key={child.id}>
                  <input type="radio" name="child" value={child.id} checked={childId === child.id} onChange={() => setChildId(child.id)} />
                  <span aria-hidden="true">{child.name === 'ともちゃん' ? '智' : '結'}</span>
                  {childDisplayName(child.name)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="milk-mother-subject"><span aria-hidden="true">♡</span><strong>ママの搾乳記録</strong></div>
        )}

        <label className="milk-field">
          <span>{eventType === 'feeding' ? '今回飲んだ量' : '今回搾乳した量'}</span>
          <span className="milk-amount-control">
            <input
              type="number"
              min="0.01"
              max="2000"
              step="0.01"
              inputMode="numeric"
              value={amountMl}
              onChange={(event) => setAmountMl(event.target.value)}
              required
            />
            <strong>mL</strong>
          </span>
        </label>

        {amountSuggestions.length > 0 && (
          <div className="milk-recent-amounts">
            <span>最近の量</span>
            <div>
              {amountSuggestions.map((amount) => (
                <button type="button" key={amount} onClick={() => setAmountMl(String(amount))}>{formatAmount(amount)}mL</button>
              ))}
            </div>
          </div>
        )}

        <label className="milk-field">
          <span>日付</span>
          <span className="milk-date-control">
            <span aria-hidden="true">{formatDateLabel(date)}</span>
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
          <legend>時間</legend>
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
          {timeType === 'unknown' && <p className="milk-time-note">タイムラインの「時刻不明」欄に表示します。</p>}
        </fieldset>

        <label className="milk-field">
          <span>フリーメモ</span>
          <textarea rows="5" maxLength="5000" value={memo} placeholder="飲み方や様子など、自由に残せます。" onChange={(event) => setMemo(event.target.value)} />
        </label>

        {error && <div className="milk-error">{error}</div>}
        <button className="milk-primary-button milk-submit-button" type="submit" disabled={status === 'loading' || status === 'submitting' || status === 'error'}>
          {status === 'submitting' ? '保存しています…' : mode === 'edit' ? '変更を保存' : '記録を保存'}
        </button>
      </form>
    </main>
  )
}

export default MilkFormPage
