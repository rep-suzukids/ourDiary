import { useEffect, useState } from 'react'
import {
  MAX_SAVED_SEARCH_KEYWORD_LENGTH,
  MAX_SAVED_SEARCH_KEYWORDS,
} from '../../shared/searchKeywordConfig.js'
import {
  createSavedSearchKeyword,
  deleteSavedSearchKeyword,
  getSavedSearchKeywords,
  reorderSavedSearchKeywords,
  updateSavedSearchKeyword,
} from '../services/searchKeywordApi.js'
import '../SearchKeywords.css'

function PencilIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Zm9.5-9.5 4 4" /></svg>
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></svg>
}

function limitKeyword(value) {
  return [...value].slice(0, MAX_SAVED_SEARCH_KEYWORD_LENGTH).join('')
}

function SearchKeywordManagementPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [keywords, setKeywords] = useState([])
  const [maxKeywords, setMaxKeywords] = useState(MAX_SAVED_SEARCH_KEYWORDS)
  const [newKeyword, setNewKeyword] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingKeyword, setEditingKeyword] = useState('')
  const [status, setStatus] = useState('loading')
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getSavedSearchKeywords(activeFamily.id)
      .then((result) => {
        if (!active) return
        setKeywords(result.keywords ?? [])
        setMaxKeywords(result.maxKeywords ?? null)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { active = false }
  }, [activeFamily.id])

  const atLimit = maxKeywords !== null && keywords.length >= maxKeywords
  const isBusy = Boolean(busyId)

  const addKeyword = async (event) => {
    event.preventDefault()
    setBusyId('new')
    setError('')
    setMessage('')
    try {
      const result = await createSavedSearchKeyword(activeFamily.id, newKeyword)
      setKeywords((current) => [...current, result.keyword])
      setNewKeyword('')
      setMessage('検索キーワードを追加しました。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  const startEditing = (item) => {
    setEditingId(item.id)
    setEditingKeyword(item.keyword)
    setError('')
    setMessage('')
  }

  const saveKeyword = async (event) => {
    event.preventDefault()
    setBusyId(editingId)
    setError('')
    setMessage('')
    try {
      const result = await updateSavedSearchKeyword(activeFamily.id, editingId, editingKeyword)
      setKeywords((current) => current.map((item) => (
        item.id === editingId ? { ...item, ...result.keyword } : item
      )))
      setEditingId('')
      setEditingKeyword('')
      setMessage('検索キーワードを変更しました。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  const moveKeyword = async (index, difference) => {
    const nextIndex = index + difference
    if (nextIndex < 0 || nextIndex >= keywords.length) return
    const reordered = [...keywords]
    const [moving] = reordered.splice(index, 1)
    reordered.splice(nextIndex, 0, moving)
    setBusyId('order')
    setError('')
    setMessage('')
    try {
      const result = await reorderSavedSearchKeywords(activeFamily.id, reordered.map((item) => item.id))
      setKeywords(result.keywords ?? reordered)
      setMessage('表示順を変更しました。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  const removeKeyword = async (item) => {
    setBusyId(item.id)
    setError('')
    setMessage('')
    try {
      await deleteSavedSearchKeyword(activeFamily.id, item.id)
      setKeywords((current) => current.filter((keyword) => keyword.id !== item.id))
      if (editingId === item.id) setEditingId('')
      setMessage('検索キーワードを削除しました。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  const navigateHome = (event) => {
    event.preventDefault()
    onNavigate('/')
  }

  return (
    <main className="search-keyword-page">
      <header className="search-keyword-page__header">
        <a href="/" onClick={navigateHome} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>検索キーワード登録</h1>
        </div>
      </header>

      <section className="search-keyword-intro">
        <div>
          <p className="search-keyword-eyebrow">Quick search</p>
          <h2>よく探す言葉を、すぐ使える場所へ</h2>
          <p>ここで登録したキーワードは、検索画面にボタンとして表示されます。ボタンを押すだけで、その言葉の検索を開始できます。</p>
        </div>
        <span className="search-keyword-intro__mark" aria-hidden="true">⌕</span>
      </section>

      <section className="search-keyword-create" aria-labelledby="search-keyword-create-title">
        <div>
          <p className="search-keyword-eyebrow">New keyword</p>
          <h2 id="search-keyword-create-title">キーワードを追加</h2>
        </div>
        <form onSubmit={addKeyword}>
          <label>
            <span>キーワード（{MAX_SAVED_SEARCH_KEYWORD_LENGTH}文字まで）</span>
            <input
              type="text"
              value={newKeyword}
              maxLength={MAX_SAVED_SEARCH_KEYWORD_LENGTH}
              placeholder="例：保育園、発熱、おでかけ"
              onChange={(event) => setNewKeyword(limitKeyword(event.target.value))}
              disabled={atLimit || isBusy}
              required
            />
          </label>
          <button type="submit" disabled={atLimit || isBusy || !newKeyword.trim()}>
            {busyId === 'new' ? '追加中…' : '＋ 追加する'}
          </button>
        </form>
        {atLimit && <p className="search-keyword-limit">キーワードの登録上限に達しました。</p>}
      </section>

      {message && <p className="search-keyword-message" role="status">{message}</p>}
      {error && <p className="search-keyword-error" role="alert">{error}</p>}

      <section className="search-keyword-list" aria-labelledby="search-keyword-list-title">
        <div className="search-keyword-list__heading">
          <div>
            <p className="search-keyword-eyebrow">Your keywords</p>
            <h2 id="search-keyword-list-title">検索画面に表示する順番</h2>
          </div>
          <span>{keywords.length}個登録中</span>
        </div>

        {status === 'loading' && <p className="search-keyword-empty">キーワードを読み込んでいます…</p>}
        {status === 'ready' && keywords.length === 0 && (
          <p className="search-keyword-empty">まだ登録されていません。よく検索する言葉を追加してみましょう。</p>
        )}

        <div className="search-keyword-cards">
          {keywords.map((item, index) => (
            <article className="search-keyword-card" key={item.id}>
              <span className="search-keyword-card__number">{index + 1}</span>
              {editingId === item.id ? (
                <form className="search-keyword-edit" onSubmit={saveKeyword}>
                  <input
                    type="text"
                    value={editingKeyword}
                    maxLength={MAX_SAVED_SEARCH_KEYWORD_LENGTH}
                    aria-label="変更後のキーワード"
                    onChange={(event) => setEditingKeyword(limitKeyword(event.target.value))}
                    autoFocus
                    required
                  />
                  <div>
                    <button type="button" onClick={() => setEditingId('')} disabled={isBusy}>やめる</button>
                    <button type="submit" disabled={isBusy || !editingKeyword.trim()}>保存</button>
                  </div>
                </form>
              ) : (
                <strong>{item.keyword}</strong>
              )}
              <div className="search-keyword-card__order" aria-label={`${item.keyword}の表示順を変更`}>
                <button type="button" onClick={() => moveKeyword(index, -1)} disabled={isBusy || index === 0} aria-label="ひとつ前へ">↑</button>
                <button type="button" onClick={() => moveKeyword(index, 1)} disabled={isBusy || index === keywords.length - 1} aria-label="ひとつ後へ">↓</button>
              </div>
              <div className="search-keyword-card__actions">
                <button type="button" onClick={() => startEditing(item)} disabled={isBusy} aria-label={`${item.keyword}を編集`} title="編集"><PencilIcon /></button>
                <button type="button" onClick={() => removeKeyword(item)} disabled={isBusy} aria-label={`${item.keyword}を削除`} title="削除"><TrashIcon /></button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default SearchKeywordManagementPage
