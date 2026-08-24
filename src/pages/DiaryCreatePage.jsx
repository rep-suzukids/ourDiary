import { useEffect, useState } from 'react'
import {
  diaryDateFromSearch,
  formatDiaryDateLabel,
  localDiaryDateString,
} from '../diaryDateUtils.js'
import { buildDiarySubjects, diarySubjectInput } from '../diarySubjects.js'
import { createDiaryEntry, getDiaryEntries } from '../services/diaryApi.js'
import '../Diary.css'

function openNativePicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
}

function initialDate() {
  return diaryDateFromSearch(window.location.search) ?? localDiaryDateString()
}

function DiaryCreatePage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [children, setChildren] = useState([])
  const [date, setDate] = useState(initialDate)
  const [subjectValue, setSubjectValue] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const subjects = buildDiarySubjects(children)

  useEffect(() => {
    if (!date) return
    const [year, month] = date.split('-').map(Number)
    getDiaryEntries(activeFamily.id, year, month)
      .then((result) => {
        if (!Array.isArray(result.children)) throw new Error('子どもの情報を取得できませんでした。')
        setChildren(result.children)
      })
      .catch((requestError) => setError(requestError.message))
  }, [activeFamily.id, date])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const subject = diarySubjectInput(subjectValue)
    if (!subject) {
      setError('だれについての日記か選択してください。')
      return
    }
    if (!text.trim()) {
      setError('日記の本文を入力してください。')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await createDiaryEntry(activeFamily.id, { ...subject, date, text })
      onNavigate(`/diary?date=${encodeURIComponent(date)}`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="diary-form-page">
      <header className="diary-page-header diary-page-header--compact">
        <a href="/diary" onClick={navigateLink('/diary')} aria-label="日記カレンダーへ戻る">←</a>
        <div>
          <p>Our Diary</p>
          <h1>日記を書く</h1>
        </div>
      </header>

      <form className="diary-form-card" onSubmit={handleSubmit}>
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

        <fieldset className="diary-child-picker">
          <legend>だれについての日記ですか？</legend>
          <div>
            {subjects.map((subject) => (
              <label key={subject.value} className={`diary-child-option diary-child-option--${subject.tone}`}>
                <input
                  type="radio"
                  name="subject"
                  value={subject.value}
                  checked={subjectValue === subject.value}
                  onChange={(event) => setSubjectValue(event.target.value)}
                  required
                />
                <span aria-hidden="true">{subject.mark}</span>
                {subject.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="diary-field">
          <span>日記</span>
          <textarea
            rows="9"
            maxLength="10000"
            value={text}
            placeholder="今日あったこと、うれしかったこと、成長したこと…"
            onChange={(event) => setText(event.target.value)}
            required
          />
        </label>

        {error && <div className="diary-error">{error}</div>}
        <button className="diary-primary-button" type="submit" disabled={isSubmitting || children.length !== 2}>
          {isSubmitting ? '保存しています…' : '日記を保存する'}
        </button>
      </form>
    </main>
  )
}

export default DiaryCreatePage
