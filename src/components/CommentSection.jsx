import { useEffect, useState } from 'react'
import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from '../services/commentApi.js'
import ReactionBar from './ReactionBar.jsx'
import '../Comment.css'

const MAX_COMMENT_LENGTH = 2000

function formatUpdatedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function CommentSection({ familyId, targetType, targetId, initialComments }) {
  const hasInitialComments = Array.isArray(initialComments)
  const [comments, setComments] = useState(hasInitialComments ? initialComments : [])
  const [status, setStatus] = useState(hasInitialComments ? 'ready' : 'loading')
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingText, setEditingText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (hasInitialComments) {
      setComments(initialComments)
      setStatus('ready')
      return undefined
    }

    let isActive = true
    setStatus('loading')
    setError('')
    getComments(familyId, targetType, targetId)
      .then((result) => {
        if (!isActive) return
        setComments(result.comments ?? [])
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [familyId, hasInitialComments, initialComments, targetId, targetType])

  const submitComment = async (event) => {
    event.preventDefault()
    if (!text.trim()) return
    setStatus('saving')
    setError('')
    try {
      const result = await createComment(familyId, targetType, targetId, text)
      setComments((current) => [...current, result.comment])
      setText('')
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editingText.trim()) return
    setStatus('saving')
    setError('')
    try {
      const result = await updateComment(familyId, editingId, editingText)
      setComments((current) => current.map((comment) => (
        comment.id === editingId ? result.comment : comment
      )))
      setEditingId('')
      setEditingText('')
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const removeComment = async (comment) => {
    if (!window.confirm('このコメントを削除すると、付けられたリアクションも削除されます。よろしいですか？')) return
    setStatus('saving')
    setError('')
    try {
      await deleteComment(familyId, comment.id)
      setComments((current) => current.filter((item) => item.id !== comment.id))
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('error')
    }
  }

  const isSaving = status === 'saving'

  return (
    <section className="comment-section" aria-label="コメント">
      <header className="comment-section__heading">
        <h3>コメント</h3>
        <span>{comments.length}件</span>
      </header>

      {status === 'loading' && <p className="comment-section__status">コメントを読み込んでいます…</p>}
      {comments.length === 0 && status !== 'loading' && (
        <p className="comment-section__empty">まだコメントはありません。</p>
      )}

      <div className="comment-section__list">
        {comments.map((comment) => (
          <article className="comment-card" key={comment.id}>
            {editingId === comment.id ? (
              <form className="comment-card__edit" onSubmit={saveEdit}>
                <textarea
                  rows="3"
                  maxLength={MAX_COMMENT_LENGTH}
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  disabled={isSaving}
                  aria-label="コメントを編集"
                  required
                />
                <div>
                  <button type="button" onClick={() => setEditingId('')} disabled={isSaving}>キャンセル</button>
                  <button type="submit" disabled={isSaving || !editingText.trim()}>保存</button>
                </div>
              </form>
            ) : (
              <>
                <p>{comment.text}</p>
                <footer>
                  <span>{comment.authorName}</span>
                  <time dateTime={comment.updatedAt}>{formatUpdatedAt(comment.updatedAt)}</time>
                  {comment.canEdit && (
                    <span className="comment-card__actions">
                      <button
                        type="button"
                        aria-label="コメントを編集"
                        title="編集"
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditingText(comment.text)
                        }}
                        disabled={isSaving}
                      >✎</button>
                      <button
                        type="button"
                        aria-label="コメントを削除"
                        title="削除"
                        onClick={() => removeComment(comment)}
                        disabled={isSaving}
                      >🗑</button>
                    </span>
                  )}
                </footer>
                <ReactionBar
                  familyId={familyId}
                  targetType="comment"
                  targetId={comment.id}
                />
              </>
            )}
          </article>
        ))}
      </div>

      {error && <p className="comment-section__error" role="alert">{error}</p>}

      <form className="comment-section__form" onSubmit={submitComment}>
        <label>
          <span className="visually-hidden">新しいコメント</span>
          <textarea
            rows="2"
            maxLength={MAX_COMMENT_LENGTH}
            value={text}
            placeholder="コメントを書く"
            onChange={(event) => setText(event.target.value)}
            disabled={isSaving || status === 'loading'}
            required
          />
        </label>
        <button type="submit" disabled={isSaving || status === 'loading' || !text.trim()}>
          {isSaving ? '送信中…' : '送信'}
        </button>
      </form>
    </section>
  )
}

export default CommentSection
