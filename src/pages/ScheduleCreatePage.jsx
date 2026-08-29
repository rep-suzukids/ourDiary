import { useState } from 'react'
import {
  diaryDateFromSearch,
  formatDiaryDateLabel,
  localDiaryDateString,
} from '../diaryDateUtils.js'
import { createSchedule } from '../services/scheduleApi.js'
import '../Diary.css'
import '../Schedule.css'

function openNativePicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
}

function initialDate() {
  return diaryDateFromSearch(window.location.search) ?? localDiaryDateString()
}

function ScheduleCreatePage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [date, setDate] = useState(initialDate)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!text.trim()) {
      setError('予定の内容を入力してください。')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await createSchedule(activeFamily.id, { date, text })
      onNavigate(`/schedule?date=${encodeURIComponent(date)}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="diary-form-page schedule-form-page">
      <header className="diary-page-header diary-page-header--compact">
        <a href="/schedule" onClick={navigateLink('/schedule')} aria-label="予定カレンダーへ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>予定を登録する</h1>
        </div>
      </header>

      <form className="diary-form-card schedule-form-card" onSubmit={handleSubmit}>
        <label className="diary-field">
          <span>日付</span>
          <span className="diary-date-control">
            <span className="diary-date-control__label" aria-hidden="true">{formatDiaryDateLabel(date)}</span>
            <input
              type="date"
              min="2026-01-01"
              max="2050-12-31"
              value={date}
              aria-label={`日付：${formatDiaryDateLabel(date)}`}
              onClick={openNativePicker}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </span>
        </label>

        <label className="diary-field">
          <span>予定の内容</span>
          <textarea
            rows="9"
            maxLength="10000"
            value={text}
            placeholder={'健診名、場所、持ち物など…\n共有したいWebページは https:// から始まるURLを入力できます。'}
            onChange={(event) => setText(event.target.value)}
            required
          />
        </label>

        <p className="schedule-form-note">https:// から始まるURLは、予定の表示時に別タブで開くリンクになります。</p>
        {error && <div className="diary-error">{error}</div>}
        <button className="diary-primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '保存しています…' : '予定を保存する'}
        </button>
      </form>
    </main>
  )
}

export default ScheduleCreatePage
