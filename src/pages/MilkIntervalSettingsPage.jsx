import { useEffect, useState } from 'react'
import {
  getMilkIntervalSettings,
  updateMilkIntervalSettings,
} from '../services/careEventApi.js'
import '../Milk.css'

function MilkIntervalSettingsPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [intervalHours, setIntervalHours] = useState('')
  const [limits, setLimits] = useState({ min: 1, max: 24 })
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true
    getMilkIntervalSettings(activeFamily.id)
      .then((result) => {
        if (!isActive) return
        setIntervalHours(result.intervalHours == null ? '' : String(result.intervalHours))
        setLimits({ min: result.minHours, max: result.maxHours })
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
    const value = Number(intervalHours)
    if (!Number.isInteger(value) || value < limits.min || value > limits.max) {
      setError(`${limits.min}〜${limits.max}の整数で入力してください。`)
      return
    }
    setStatus('saving')
    setError('')
    setMessage('')
    try {
      const result = await updateMilkIntervalSettings(activeFamily.id, value)
      setIntervalHours(String(result.intervalHours))
      setMessage('ミルク時間間隔を保存しました。')
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  return (
    <main className="milk-page milk-interval-settings-page">
      <header className="milk-page-header milk-page-header--compact">
        <a href="/" aria-label="TOPへ戻る" onClick={(event) => { event.preventDefault(); onNavigate('/') }}>←</a>
        <div><p>{activeFamily.name}</p><h1>ミルク時間間隔</h1></div>
      </header>

      <section className="milk-interval-settings-card" aria-labelledby="milk-interval-title">
        <p className="milk-interval-settings-card__eyebrow">Next feeding</p>
        <h2 id="milk-interval-title">次のミルク予定を設定</h2>
        <p className="milk-interval-settings-card__description">
          智ちゃん・結ちゃんそれぞれの直近のミルク時刻から、設定した時間後を次の予定としてタイムラインに表示します。
        </p>
        <form onSubmit={submit}>
          <label className="milk-interval-field">
            <span>ミルク時間間隔</span>
            <span className="milk-interval-input">
              <input
                type="number"
                min={limits.min}
                max={limits.max}
                step="1"
                inputMode="numeric"
                value={intervalHours}
                onChange={(event) => setIntervalHours(event.target.value)}
                disabled={status === 'loading' || status === 'saving'}
                required
              />
              <span>時間後</span>
            </span>
          </label>
          <p className="milk-interval-settings-card__note">
            「時刻を指定」で登録した最新のミルク記録を基準にします。
          </p>
          {error && <div className="milk-error" role="alert">{error}</div>}
          {message && <div className="milk-interval-message" role="status">{message}</div>}
          <button className="milk-primary-button" type="submit" disabled={status !== 'ready'}>
            {status === 'saving' ? '保存しています…' : '設定を保存する'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default MilkIntervalSettingsPage
