import { useEffect, useMemo, useRef, useState } from 'react'
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
  createMedicationAdministration,
  getMedicationDay,
  updateMedicationAdministration,
} from '../services/medicationApi.js'
import '../Milk.css'
import '../Medication.css'

function queryValue(name) {
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

function initialDate() {
  const requested = queryValue('date')
  return /^20(?:2[6-9]|[3-4]\d|50)-\d{2}-\d{2}$/.test(requested) ? requested : localDateString()
}

function requestedReturnPath() {
  const requested = queryValue('returnTo')
  if (!requested.startsWith('/') || requested.startsWith('//')) return ''
  const destination = new URL(requested, window.location.origin)
  if (destination.origin !== window.location.origin) return ''
  return `${destination.pathname}${destination.search}${destination.hash}`
}

function MedicationFormPage({ session, onNavigate, mode = 'create' }) {
  const activeFamily = session.families[0]
  const administrationId = mode === 'edit' ? queryValue('id') : ''
  const returnPath = requestedReturnPath()
  const initializedEdit = useRef(false)
  const initializedRequestedSelection = useRef(false)
  const [children, setChildren] = useState([])
  const [dueSchedules, setDueSchedules] = useState([])
  const [editTarget, setEditTarget] = useState(null)
  const [childId, setChildId] = useState('')
  const [scheduleId, setScheduleId] = useState('')
  const [date, setDate] = useState(initialDate)
  const [timeType, setTimeType] = useState('exact')
  const [time, setTime] = useState(localTimeString)
  const [timePeriod, setTimePeriod] = useState('morning')
  const [memo, setMemo] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    setStatus('loading')
    setError('')
    getMedicationDay(activeFamily.id, date)
      .then((result) => {
        if (!isActive) return
        setChildren(result.children)
        setDueSchedules(result.dueSchedules)

        if (mode === 'edit' && !initializedEdit.current) {
          const target = result.administrations.find((item) => item.id === administrationId)
          if (!target) throw new Error('編集する投薬記録が見つかりませんでした。')
          initializedEdit.current = true
          setEditTarget(target)
          setChildId(target.childId)
          setScheduleId(target.scheduleId)
          setTimeType(target.timeType)
          setTime(target.time ?? localTimeString())
          setTimePeriod(target.timePeriod ?? 'morning')
          setMemo(target.memo)
        } else if (mode === 'create' && !initializedRequestedSelection.current) {
          const requestedTone = queryValue('child')
          const requestedScheduleId = queryValue('schedule')
          const resolvedChild = result.children.find((child) => childTone(child.name) === requestedTone)
          const resolvedChildId = resolvedChild?.id ?? ''
          if (resolvedChildId) setChildId(resolvedChildId)
          const options = result.dueSchedules.filter((item) => (
            item.childId === resolvedChildId && !item.isAdministered
          ))
          const requestedSchedule = options.find((item) => item.scheduleId === requestedScheduleId)
          setScheduleId(requestedSchedule?.scheduleId ?? (options.length === 1 ? options[0].scheduleId : ''))
          initializedRequestedSelection.current = true
        }
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id, administrationId, date, mode])

  const medicationOptions = useMemo(() => {
    const options = dueSchedules.filter((item) => (
      item.childId === childId && (!item.isAdministered || item.scheduleId === editTarget?.scheduleId)
    ))
    if (editTarget && editTarget.childId === childId && !options.some((item) => item.scheduleId === editTarget.scheduleId)) {
      return [...options, editTarget]
    }
    return options
  }, [childId, dueSchedules, editTarget])

  const chooseChild = (nextChildId) => {
    setChildId(nextChildId)
    const options = dueSchedules.filter((item) => item.childId === nextChildId && !item.isAdministered)
    setScheduleId(options.length === 1 ? options[0].scheduleId : '')
  }

  const chooseNow = () => {
    setDate(localDateString())
    setTime(localTimeString())
    setTimeType('exact')
  }

  const selectedSchedule = medicationOptions.find((item) => item.scheduleId === scheduleId)
    ?? (editTarget?.scheduleId === scheduleId ? editTarget : null)
  const fallbackPath = `/timeline?${new URLSearchParams({
    date,
    child: children.find((child) => child.id === childId) ? childTone(children.find((child) => child.id === childId).name) : 'both',
  })}`
  const backPath = returnPath || fallbackPath

  const submit = async (event) => {
    event.preventDefault()
    if (!childId || !selectedSchedule) {
      setError('対象の子どもとおくすりを選択してください。')
      return
    }
    if (timeType === 'period' && !timePeriod) {
      setError('だいたいの時間帯を選択してください。')
      return
    }
    setStatus('saving')
    setError('')
    const values = {
      medicationId: selectedSchedule.medicationId,
      scheduleId: selectedSchedule.scheduleId,
      childId,
      date,
      timeType,
      time: timeType === 'exact' ? time : null,
      timePeriod: timeType === 'period' ? timePeriod : null,
      memo,
    }
    try {
      if (mode === 'edit') await updateMedicationAdministration(activeFamily.id, { id: administrationId, ...values })
      else await createMedicationAdministration(activeFamily.id, values)
      onNavigate(backPath, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const navigateBack = (event) => {
    event.preventDefault()
    onNavigate(backPath)
  }

  return (
    <main className="milk-page milk-form-page medication-form-page">
      <header className="milk-page-header milk-page-header--compact">
        <a href={backPath} onClick={navigateBack} aria-label="タイムラインへ戻る">←</a>
        <div><p>Our Diary</p><h1>{mode === 'edit' ? '投薬記録を編集' : 'おくすりを記録'}</h1></div>
      </header>

      <form className="milk-form-card" onSubmit={submit}>
        <fieldset className="milk-fieldset">
          <legend>誰のおくすりですか？</legend>
          <div className="milk-child-options">
            {children.map((child) => (
              <label className={`milk-child-option milk-child-option--${childTone(child.name)}${childId === child.id ? ' is-selected' : ''}`} key={child.id}>
                <input type="radio" name="child" checked={childId === child.id} onChange={() => chooseChild(child.id)} />
                <span aria-hidden="true">{childTone(child.name) === 'tomo' ? '智' : '結'}</span>
                {childDisplayName(child.name)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="milk-fieldset">
          <legend>何を飲みましたか？</legend>
          {childId && medicationOptions.length > 0 ? (
            <div className="medication-options">
              {medicationOptions.map((option) => (
                <label className={`medication-option${scheduleId === option.scheduleId ? ' is-selected' : ''}`} key={option.scheduleId}>
                  <input type="radio" name="medication" checked={scheduleId === option.scheduleId} onChange={() => setScheduleId(option.scheduleId)} />
                  <span aria-hidden="true">●</span>
                  {option.medicationName}
                </label>
              ))}
            </div>
          ) : (
            <p className="medication-form-note">{childId ? 'この日に未投薬のおくすりはありません。' : '先に対象の子どもを選択してください。'}</p>
          )}
        </fieldset>

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
              onChange={(event) => { setDate(event.target.value); setScheduleId('') }}
              required
            />
          </span>
        </label>

        <fieldset className="milk-fieldset">
          <legend>投薬時間</legend>
          <button className="milk-now-button" type="button" onClick={chooseNow}>今の日時を使う</button>
          <div className="milk-time-types">
            <label><input type="radio" name="timeType" checked={timeType === 'exact'} onChange={() => setTimeType('exact')} />時刻を指定</label>
            <label><input type="radio" name="timeType" checked={timeType === 'period'} onChange={() => setTimeType('period')} />だいたい</label>
            <label><input type="radio" name="timeType" checked={timeType === 'unknown'} onChange={() => setTimeType('unknown')} />不明</label>
          </div>
          {timeType === 'exact' && <input className="milk-time-input" type="time" value={time} onClick={openNativePicker} onChange={(event) => setTime(event.target.value)} required />}
          {timeType === 'period' && (
            <div className="milk-period-options">
              {TIME_PERIOD_OPTIONS.map((option) => (
                <button type="button" className={timePeriod === option.value ? 'is-selected' : ''} key={option.value} onClick={() => setTimePeriod(option.value)}>{option.label}</button>
              ))}
            </div>
          )}
          {timeType === 'unknown' && <p className="milk-time-note">時刻不明の記録として表示します。</p>}
        </fieldset>

        <label className="milk-field">
          <span>フリーメモ</span>
          <textarea rows="5" maxLength="5000" value={memo} placeholder="飲ませたときの様子などを残せます。" onChange={(event) => setMemo(event.target.value)} />
        </label>

        {error && <div className="milk-error" role="alert">{error}</div>}
        <button className="milk-primary-button milk-submit-button medication-primary-button" type="submit" disabled={status !== 'ready' || !selectedSchedule}>
          {status === 'saving' ? '保存しています…' : mode === 'edit' ? '変更を保存' : '投薬を記録する'}
        </button>
      </form>
    </main>
  )
}

export default MedicationFormPage
