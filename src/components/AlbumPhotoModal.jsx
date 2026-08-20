import { useEffect, useRef, useState } from 'react'
import { getTags, updatePhotoTags } from '../services/tagApi.js'

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5V11l8.1 8.1a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L11 4H5.5A1.5 1.5 0 0 0 4 5.5Z" />
      <circle cx="8" cy="8" r="1.2" />
    </svg>
  )
}

function AlbumPhotoModal({
  photo,
  imageUrl,
  familyId,
  canEditTags,
  canManageTags,
  onTagsChange,
  onClose,
}) {
  const closeButtonRef = useRef(null)
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [tags, setTags] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(photo.tagIds ?? [])
  const [tagStatus, setTagStatus] = useState('idle')
  const [tagError, setTagError] = useState('')

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (isEditingTags) setIsEditingTags(false)
      else onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditingTags, onClose])

  const openTagEditor = () => {
    setIsEditingTags(true)
    setSelectedTagIds(photo.tagIds ?? [])
    setTagError('')
    if (tags.length > 0 || tagStatus === 'loading') return
    setTagStatus('loading')
    getTags(familyId)
      .then((result) => {
        setTags(result.tags)
        setTagStatus('ready')
      })
      .catch((error) => {
        setTagError(error.message)
        setTagStatus('error')
      })
  }

  const toggleTag = (tagId) => {
    setSelectedTagIds((current) => (
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId]
    ))
  }

  const saveTags = async () => {
    setTagStatus('saving')
    setTagError('')
    try {
      const result = await updatePhotoTags(familyId, photo.albumFileId, selectedTagIds)
      onTagsChange(photo.albumFileId, result.tagIds)
      setIsEditingTags(false)
      setTagStatus('ready')
    } catch (error) {
      setTagError(error.message)
      setTagStatus('error')
    }
  }

  return (
    <div
      className="album-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.name}の拡大表示`}
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={`album-modal__content${isEditingTags ? ' album-modal__content--tagging' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="album-modal__photo-area">
          <img src={imageUrl} alt={photo.name} />
          {!isEditingTags && (
            <button
              ref={closeButtonRef}
              type="button"
              className="album-modal__close"
              aria-label="拡大画像を閉じる"
              onClick={onClose}
            >
              ×
            </button>
          )}
          <div className="album-modal__footer">
            <p>{photo.name}</p>
            {canEditTags && !isEditingTags && (
              <button className="album-modal__tag-button" type="button" onClick={openTagEditor}>
                <TagIcon />
                タグを編集
              </button>
            )}
          </div>
        </div>

        {isEditingTags && (
          <aside className="album-tag-editor" aria-label="写真のタグ編集">
            <div className="album-tag-editor__heading">
              <div>
                <span>Photo tags</span>
                <h2>タグを選ぶ</h2>
              </div>
              <button ref={closeButtonRef} type="button" onClick={() => setIsEditingTags(false)} aria-label="タグ編集を閉じる">×</button>
            </div>

            {tagStatus === 'loading' && <p className="album-tag-editor__message">タグを読み込んでいます…</p>}
            {tagError && <p className="album-tag-editor__error">{tagError}</p>}
            {tagStatus !== 'loading' && tags.length === 0 && !tagError && (
              <div className="album-tag-editor__empty">
                <p>使用できるタグがまだありません。</p>
                {canManageTags && <a href="/admin/tags">タグを作成する</a>}
              </div>
            )}
            {tags.length > 0 && (
              <div className="album-tag-editor__choices">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id)
                  return (
                    <label className={isSelected ? 'is-selected' : ''} key={tag.id}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTag(tag.id)}
                        disabled={tagStatus === 'saving'}
                      />
                      <span aria-hidden="true">#</span>
                      <strong>{tag.name}</strong>
                    </label>
                  )
                })}
              </div>
            )}

            <div className="album-tag-editor__actions">
              <button type="button" onClick={() => setIsEditingTags(false)} disabled={tagStatus === 'saving'}>キャンセル</button>
              <button type="button" onClick={saveTags} disabled={tagStatus === 'loading' || tagStatus === 'saving'}>
                {tagStatus === 'saving' ? '保存しています…' : '保存する'}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

export default AlbumPhotoModal
