import { useEffect, useState } from 'react'
import { MAX_TAG_NAME_LENGTH, MAX_TAGS } from '../../shared/tagConfig.js'
import { createTag, deleteTag, getTags, updateTag } from '../services/tagApi.js'
import '../Tags.css'

function PencilIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Zm9.5-9.5 4 4" /></svg>
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></svg>
}

function limitTagName(value) {
  return [...value].slice(0, MAX_TAG_NAME_LENGTH).join('')
}

function DeleteDialog({ tag, onCancel, onConfirm, isDeleting }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isDeleting) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isDeleting, onCancel])

  return (
    <div className="tag-dialog" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isDeleting) onCancel()
    }}>
      <section className="tag-dialog__card" role="dialog" aria-modal="true" aria-labelledby="tag-delete-title">
        <span className="tag-dialog__icon" aria-hidden="true">!</span>
        <p className="tag-dialog__eyebrow">削除前にご確認ください</p>
        <h2 id="tag-delete-title">「{tag.name}」を削除しますか？</h2>
        <p>
          このタグが設定されている写真
          <strong>{tag.photoCount}枚</strong>
          からもタグが外れます。写真そのものは削除されません。
        </p>
        <p className="tag-dialog__warning">この操作は元に戻せません。</p>
        <div className="tag-dialog__actions">
          <button type="button" onClick={onCancel} disabled={isDeleting}>キャンセル</button>
          <button type="button" className="is-danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? '削除しています…' : '削除する'}
          </button>
        </div>
      </section>
    </div>
  )
}

function TagManagementPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [tags, setTags] = useState([])
  const [maxTags, setMaxTags] = useState(MAX_TAGS)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let active = true
    getTags(activeFamily.id)
      .then((result) => {
        if (!active) return
        setTags(result.tags)
        setMaxTags(result.maxTags)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { active = false }
  }, [activeFamily.id])

  const atLimit = maxTags !== null && tags.length >= maxTags

  const navigateHome = (event) => {
    event.preventDefault()
    onNavigate('/')
  }

  const addTag = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await createTag(activeFamily.id, newName)
      setTags((current) => [...current, result.tag])
      setNewName('')
      setMessage('タグを追加しました。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = (tag) => {
    setEditingId(tag.id)
    setEditingName(tag.name)
    setError('')
    setMessage('')
  }

  const saveTag = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const result = await updateTag(activeFamily.id, editingId, editingName)
      setTags((current) => current.map((tag) => (
        tag.id === editingId ? { ...tag, ...result.tag } : tag
      )))
      setEditingId('')
      setEditingName('')
      setMessage('タグ名を変更しました。')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const removeTag = async () => {
    setIsDeleting(true)
    setError('')
    try {
      await deleteTag(activeFamily.id, deleteTarget.id)
      setTags((current) => current.filter((tag) => tag.id !== deleteTarget.id))
      setDeleteTarget(null)
      setMessage('タグを削除しました。')
    } catch (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="tag-page">
      <header className="tag-page__header">
        <a href="/" onClick={navigateHome} aria-label="TOPへ戻る">←</a>
        <div>
          <p>{activeFamily.name}</p>
          <h1>タグの管理</h1>
        </div>
      </header>

      <section className="tag-intro">
        <div>
          <p className="tag-intro__eyebrow">Album tags</p>
          <h2>思い出を見つける目印を作ろう</h2>
          <p>ここで作ったタグは、これから写真を整理するときに使えます。</p>
        </div>
        <div className={`tag-count${atLimit ? ' is-full' : ''}`} aria-label={`${tags.length}個のタグを登録済み`}>
          <strong>{tags.length}</strong>
          <span>{maxTags === null ? '個' : `/ ${maxTags}`}</span>
        </div>
      </section>

      <section className="tag-create-card" aria-labelledby="tag-create-title">
        <div>
          <p>New tag</p>
          <h2 id="tag-create-title">新しいタグを追加</h2>
        </div>
        <form onSubmit={addTag}>
          <label>
            <span>タグ名</span>
            <input
              type="text"
              value={newName}
              placeholder="例：おでかけ、寝顔、記念日"
              onChange={(event) => setNewName(limitTagName(event.target.value))}
              disabled={atLimit || isSaving}
              required
            />
          </label>
          <button type="submit" disabled={atLimit || isSaving || !newName.trim()}>
            {isSaving ? '追加中…' : '＋ 追加する'}
          </button>
        </form>
        <p className="tag-duplicate-note">
          <span aria-hidden="true">i</span>
          同じ名前のタグも登録できます。見分けにくくなる場合があるためご注意ください。
        </p>
        {atLimit && <p className="tag-limit-note">タグの登録上限に達しました。</p>}
      </section>

      {message && <p className="tag-message" role="status">{message}</p>}
      {error && <div className="tag-error" role="alert">{error}</div>}

      <section className="tag-collection" aria-labelledby="tag-list-title">
        <div className="tag-collection__heading">
          <div>
            <p>Your tags</p>
            <h2 id="tag-list-title">登録したタグ</h2>
          </div>
          <span>作成した順に並んでいます</span>
        </div>

        {status === 'loading' && <p className="tag-empty">タグを読み込んでいます…</p>}
        {status === 'ready' && tags.length === 0 && (
          <div className="tag-empty">
            <span aria-hidden="true">#</span>
            <p>タグはまだありません。最初の目印を作ってみましょう。</p>
          </div>
        )}

        <div className="tag-cloud">
          {tags.map((tag) => (
            <article className="tag-chip-card" key={tag.id}>
              {editingId === tag.id ? (
                <form className="tag-edit-form" onSubmit={saveTag}>
                  <label>
                    <span className="visually-hidden">変更後のタグ名</span>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(event) => setEditingName(limitTagName(event.target.value))}
                      autoFocus
                      required
                    />
                  </label>
                  <div>
                    <button type="button" onClick={() => setEditingId('')} disabled={isSaving}>やめる</button>
                    <button type="submit" disabled={isSaving || !editingName.trim()}>保存</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="tag-chip-card__name">
                    <span aria-hidden="true">#</span>
                    <strong>{tag.name}</strong>
                  </div>
                  <p>{tag.photoCount > 0 ? `${tag.photoCount}枚の写真で使用中` : '写真への設定はまだありません'}</p>
                  <div className="tag-chip-card__actions">
                    <button type="button" onClick={() => startEditing(tag)} aria-label={`${tag.name}の名前を変更`} title="名前を変更">
                      <PencilIcon />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(tag)} aria-label={`${tag.name}を削除`} title="削除">
                      <TrashIcon />
                    </button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      {deleteTarget && (
        <DeleteDialog
          tag={deleteTarget}
          isDeleting={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeTag}
        />
      )}
    </main>
  )
}

export default TagManagementPage
