import { useEffect, useState } from 'react'
import { createDiaryEntry, getDiaryEntries } from '../services/diaryApi.js'
import '../Diary.css'

function openNativePicker(event) {
  if (typeof event.currentTarget.showPicker === 'function') event.currentTarget.showPicker()
}

function localDateString() {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

function formatDateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '日付を選択してください'
  const [year, month, day] = value.split('-').map(Number)
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(year, month - 1, day).getDay()]
  return `${year}年${month}月${day}日（${weekday}）`
}

function DiaryCreatePage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [children, setChildren] = useState([])
  const [date, setDate] = useState(localDateString)
  const [childId, setChildId] = useState('')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!date) return
    const [year, month] = date.split('-').map(Number)
    getDiaryEntries(session.credential, activeFamily.id, year, month)
      .then((result) => {
        if (!Array.isArray(result.children)) throw new Error('子どもの情報を取得できませんでした。')
        setChildren(result.children)
      })
      .catch((requestError) => setError(requestError.message))
  }, [activeFamily.id, date, session.credential])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!childId) {
      setError('どちらの子どもの日記か選択してください。')
      return
    }
    if (!text.trim()) {
      setError('日記の本文を入力してください。')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await createDiaryEntry(session.credential, activeFamily.id, { childId, date, text })
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
          <h1>今日のことを書く</h1>
        </div>
      </header>

      <form className="diary-form-card" onSubmit={handleSubmit}>
        <label className="diary-field">
          <span>日付</span>
          <span className="diary-date-control">
            <span className="diary-date-control__label" aria-hidden="true">{formatDateLabel(date)}</span>
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

        <fieldset className="diary-child-picker">
          <legend>どちらの子どもの日記ですか？</legend>
          <div>
            {children.map((child) => (
              <label key={child.id} className={`diary-child-option diary-child-option--${child.name === 'ともちゃん' ? 'tomo' : 'yuu'}`}>
                <input
                  type="radio"
                  name="child"
                  value={child.id}
                  checked={childId === child.id}
                  onChange={(event) => setChildId(event.target.value)}
                  required
                />
                <span aria-hidden="true">{child.name === 'ともちゃん' ? '智' : '結'}</span>
                {child.name}
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
