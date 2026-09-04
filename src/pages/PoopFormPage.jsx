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
  BOWEL_AMOUNT_OPTIONS,
  BOWEL_COLOR_OPTIONS,
  BOWEL_CONSISTENCY_OPTIONS,
  URINE_AMOUNT_OPTIONS,
} from '../bowelEventUtils.js'
import { createBowelEvent, getBowelEvents, updateBowelEvent } from '../services/bowelEventApi.js'
import '../Milk.css'
import '../Poop.css'

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

function PoopFormPage({ session, onNavigate, mode = 'create' }) {
  const activeFamily = session.families[0]
  const eventId = mode === 'edit' ? queryValue('id') : ''
  const initializedEdit = useRef(false)
  const initializedRequestedChild = useRef(false)
  const [children, setChildren] = useState([])
  const [childId, setChildId] = useState('')
  const [amount, setAmount] = useState('')
  const [consistency, setConsistency] = useState('')
  const [color, setColor] = useState('')
  const [urineAmount, setUrineAmount] = useState('')
  const [date, setDate] = useState(initialDate)
  const [timeType, setTimeType] = useState('exact')
  const [time, setTime] = useState(localTimeString)
  const [timePeriod, setTimePeriod] = useState('morning')
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState(mode === 'edit' ? 'loading' : 'ready')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    getBowelEvents(activeFamily.id, date)
      .then((result) => {
        if (!isActive) return
        setChildren(result.children)
        if (mode === 'create' && !initializedRequestedChild.current) {
          const tone = requestedChildTone()
          const requestedChild = result.children.find((child) => childTone(child.name) === tone)
          if (requestedChild) setChildId(requestedChild.id)
          initializedRequestedChild.current = true
        }
        if (mode === 'edit' && !initializedEdit.current) {
          const target = result.events.find((event) => event.id === eventId)
          if (!target) throw new Error('編集する記録が見つかりませんでした。')
          initializedEdit.current = true
          setChildId(target.childId)
          setAmount(target.amount ?? '')
          setConsistency(target.consistency ?? '')
          setColor(target.color ?? '')
          setUrineAmount(target.urineAmount ?? '')
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
    if (!urineAmount && !amount) {
      setError('おしっこ・うんちのどちらか一方以上を入力してください。')
      return
    }
    if (amount && (!consistency || !color)) {
      setError('うんちを記録する場合は、量・かたさ・色をすべて選択してください。')
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
      amount,
      consistency,
      color,
      urineAmount,
      date,
      timeType,
      time: timeType === 'exact' ? time : null,
      timePeriod: timeType === 'period' ? timePeriod : null,
      memo,
    }
    try {
      if (mode === 'edit') {
        await updateBowelEvent(activeFamily.id, { id: eventId, ...values })
      } else {
        await createBowelEvent(activeFamily.id, values)
      }
      onNavigate(`/poop?date=${date}`, { replace: mode === 'create' })
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
    <main className="milk-page milk-form-page poop-page poop-form-page">
      <header className="milk-page-header milk-page-header--compact">
        <a href={`/poop?date=${date}`} onClick={navigateLink(`/poop?date=${date}`)} aria-label="おむつの記録へ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>{mode === 'edit' ? 'おむつ記録を編集' : 'おむつを記録'}</h1>
        </div>
      </header>

      <form className="milk-form-card" onSubmit={handleSubmit}>
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

        <fieldset className="milk-fieldset poop-choice-fieldset">
          <legend>おしっこの量</legend>
          <p className="poop-choice-help">おしっこがなかった場合は「なし」を選んでください。</p>
          <div className="poop-choice-options">
            <label className={urineAmount === '' ? 'is-selected' : ''}>
              <input type="radio" name="urineAmount" value="" checked={urineAmount === ''} onChange={() => setUrineAmount('')} />
              なし
            </label>
            {URINE_AMOUNT_OPTIONS.map((option) => (
              <label className={urineAmount === option.value ? 'is-selected' : ''} key={option.value}>
                <input type="radio" name="urineAmount" value={option.value} checked={urineAmount === option.value} onChange={() => setUrineAmount(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <p className="poop-form-note">おしっこ・うんちのどちらか一方以上を記録してください。両方あった場合は、続けて両方を選べます。</p>

        <fieldset className="milk-fieldset poop-choice-fieldset">
          <legend>うんちの量</legend>
          <p className="poop-choice-help">うんちがなかった場合は「なし」を選んでください。</p>
          <div className="poop-choice-options poop-choice-options--bowel-amount">
            <label className={amount === '' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="amount"
                value=""
                checked={amount === ''}
                onChange={() => {
                  setAmount('')
                  setConsistency('')
                  setColor('')
                }}
              />
              なし
            </label>
            {BOWEL_AMOUNT_OPTIONS.map((option) => (
              <label className={amount === option.value ? 'is-selected' : ''} key={option.value}>
                <input type="radio" name="amount" value={option.value} checked={amount === option.value} onChange={() => setAmount(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {amount && <fieldset className="milk-fieldset poop-choice-fieldset">
          <legend>かたさ</legend>
          <div className="poop-choice-options">
            {BOWEL_CONSISTENCY_OPTIONS.map((option) => (
              <label className={consistency === option.value ? 'is-selected' : ''} key={option.value}>
                <input type="radio" name="consistency" value={option.value} checked={consistency === option.value} onChange={() => setConsistency(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>}

        {amount && <fieldset className="milk-fieldset poop-choice-fieldset">
          <legend>色</legend>
          <div className="poop-color-options">
            {BOWEL_COLOR_OPTIONS.map((option) => (
              <label className={color === option.value ? 'is-selected' : ''} key={option.value}>
                <input type="radio" name="color" value={option.value} checked={color === option.value} onChange={() => setColor(option.value)} />
                <span className={`poop-color-dot poop-color-dot--${option.value}`} aria-hidden="true" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>}

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
          <textarea rows="5" maxLength="5000" value={memo} placeholder="回数や様子など、気になったことを自由に残せます。" onChange={(event) => setMemo(event.target.value)} />
        </label>

        {error && <div className="milk-error">{error}</div>}
        <button className="milk-primary-button milk-submit-button poop-primary-button" type="submit" disabled={status === 'loading' || status === 'submitting'}>
          {status === 'submitting' ? '保存しています…' : mode === 'edit' ? '変更を保存' : '記録を保存'}
        </button>
      </form>
    </main>
  )
}

export default PoopFormPage
