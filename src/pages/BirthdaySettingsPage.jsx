import { useEffect, useState } from 'react'
import { childDisplayName, childTone, localDateString, openNativePicker } from '../careEventUtils.js'
import { getChildBirthdays, updateChildBirthdays } from '../services/birthdayApi.js'
import '../Birthday.css'

function BirthdaySettingsPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [children, setChildren] = useState([])
  const [birthDates, setBirthDates] = useState({})
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    getChildBirthdays(activeFamily.id)
      .then((result) => {
        if (!isActive) return
        const loadedChildren = result.children ?? []
        setChildren(loadedChildren)
        setBirthDates(Object.fromEntries(loadedChildren.map((child) => [child.id, child.birthDate ?? ''])))
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id])

  const submit = async (event) => {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    setError('')
    try {
      const result = await updateChildBirthdays(activeFamily.id, children.map((child) => ({
        childId: child.id,
        birthDate: birthDates[child.id] || null,
      })))
      const savedChildren = result.children ?? []
      setChildren(savedChildren)
      setBirthDates(Object.fromEntries(savedChildren.map((child) => [child.id, child.birthDate ?? ''])))
      setMessage('誕生日を保存しました。')
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  return (
    <main className="birthday-page">
      <header className="birthday-page__header">
        <a href="/" aria-label="TOPへ戻る" onClick={(event) => { event.preventDefault(); onNavigate('/') }}>←</a>
        <div><p>{activeFamily.name}</p><h1>誕生日設定</h1></div>
      </header>

      <section className="birthday-settings-card" aria-labelledby="birthday-settings-title">
        <p className="birthday-settings-card__eyebrow">Birthday</p>
        <h2 id="birthday-settings-title">ふたりの誕生日</h2>
        <p className="birthday-settings-card__description">
          設定した誕生日をもとに、TOP画面へ現在の年齢と生後日数を表示します。未設定の子は表示されません。
        </p>

        {status === 'loading' && <p className="birthday-settings-card__state">誕生日を読み込んでいます…</p>}
        {status !== 'loading' && (
          <form onSubmit={submit}>
            <div className="birthday-fields">
              {children.map((child) => (
                <label className={`birthday-field birthday-field--${childTone(child.name)}`} key={child.id}>
                  <span><b aria-hidden="true">{childDisplayName(child.name).slice(0, 1)}</b>{childDisplayName(child.name)}</span>
                  <input
                    type="date"
                    max={localDateString()}
                    value={birthDates[child.id] ?? ''}
                    onClick={openNativePicker}
                    onChange={(event) => setBirthDates((current) => ({ ...current, [child.id]: event.target.value }))}
                    disabled={status === 'saving'}
                    aria-label={`${childDisplayName(child.name)}の誕生日`}
                  />
                  {birthDates[child.id] && (
                    <button type="button" onClick={() => setBirthDates((current) => ({ ...current, [child.id]: '' }))}>未設定に戻す</button>
                  )}
                </label>
              ))}
            </div>
            {error && <div className="birthday-error" role="alert">{error}</div>}
            {message && <div className="birthday-message" role="status">{message}</div>}
            <button className="birthday-save-button" type="submit" disabled={status !== 'ready' || children.length === 0}>
              {status === 'saving' ? '保存しています…' : '誕生日を保存する'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

export default BirthdaySettingsPage
