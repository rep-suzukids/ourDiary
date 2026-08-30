import { useEffect, useRef, useState } from 'react'
import CommentSection from './CommentSection.jsx'
import ReactionBar from './ReactionBar.jsx'
import { updatePhotoFavorite, updatePhotoVisibility } from '../services/albumApi.js'
import { getTags, updatePhotoTags } from '../services/tagApi.js'

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5V11l8.1 8.1a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L11 4H5.5A1.5 1.5 0 0 0 4 5.5Z" />
      <circle cx="8" cy="8" r="1.2" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.2 4.7 13A4.8 4.8 0 0 1 11.5 6.2l.5.5.5-.5A4.8 4.8 0 0 1 19.3 13Z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5h14v10H9l-4 3v-13Z" />
    </svg>
  )
}

function AlbumPhotoModal({
  photo,
  imageUrl,
  familyId,
  canEditTags,
  canManageTags,
  canPublishPhotos,
  onTagsChange,
  onFavoriteChange,
  onVisibilityChange,
  onClose,
}) {
  const closeButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [isViewingComments, setIsViewingComments] = useState(false)
  const [tags, setTags] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(photo.tagIds ?? [])
  const [tagStatus, setTagStatus] = useState('idle')
  const [tagError, setTagError] = useState('')
  const [isFavorite, setIsFavorite] = useState(Boolean(photo.isFavorite))
  const [favoriteStatus, setFavoriteStatus] = useState('idle')
  const [favoriteError, setFavoriteError] = useState('')
  const [isPublished, setIsPublished] = useState(Boolean(photo.isPublished))
  const [visibilityStatus, setVisibilityStatus] = useState('idle')
  const [visibilityError, setVisibilityError] = useState('')

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (isEditingTags) setIsEditingTags(false)
      else if (isViewingComments) setIsViewingComments(false)
      else onCloseRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditingTags, isViewingComments])

  const openTagEditor = () => {
    setIsEditingTags(true)
    setIsViewingComments(false)
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

  const openComments = () => {
    setIsViewingComments(true)
    setIsEditingTags(false)
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

  const toggleFavorite = async () => {
    const nextFavorite = !isFavorite
    setFavoriteStatus('saving')
    setFavoriteError('')
    try {
      const result = await updatePhotoFavorite(familyId, photo.albumFileId, nextFavorite)
      setIsFavorite(result.isFavorite)
      onFavoriteChange(photo.albumFileId, result.isFavorite)
      setFavoriteStatus('idle')
    } catch (error) {
      setFavoriteError(error.message)
      setFavoriteStatus('error')
    }
  }

  const toggleVisibility = async () => {
    const nextPublished = !isPublished
    setVisibilityStatus('saving')
    setVisibilityError('')
    try {
      const result = await updatePhotoVisibility(familyId, photo.albumFileId, nextPublished)
      setIsPublished(result.isPublished)
      onVisibilityChange(photo.albumFileId, result.isPublished)
      setVisibilityStatus('idle')
    } catch (error) {
      setVisibilityError(error.message)
      setVisibilityStatus('error')
    }
  }

  return (
    <div
      className="album-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.name}の拡大表示`}
      onClick={onClose}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={`album-modal__content${isEditingTags || isViewingComments ? ' album-modal__content--tagging' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="album-modal__photo-area">
          <img
            src={imageUrl}
            alt={photo.name}
            draggable="false"
            onContextMenu={(event) => event.preventDefault()}
          />
          {!isEditingTags && !isViewingComments && (
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
          {!isEditingTags && !isViewingComments && (
            <div className="album-modal__footer">
              <ReactionBar
                familyId={familyId}
                targetType="photo"
                targetId={photo.albumFileId}
              />
              <div className="album-modal__photo-actions">
                {canPublishPhotos && (
                  <div className="album-modal__visibility" aria-label="写真の公開設定">
                    <span className={!isPublished ? 'is-active' : ''}>非公開</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPublished}
                      aria-label={isPublished ? '公開中。非公開に変更' : '非公開。公開に変更'}
                      onClick={toggleVisibility}
                      disabled={visibilityStatus === 'saving'}
                    >
                      <span />
                    </button>
                    <span className={isPublished ? 'is-active' : ''}>公開</span>
                  </div>
                )}
                <button
                  className={`album-modal__favorite-button${isFavorite ? ' is-favorite' : ''}`}
                  type="button"
                  aria-pressed={isFavorite}
                  onClick={toggleFavorite}
                  disabled={favoriteStatus === 'saving'}
                >
                  <HeartIcon />
                  {favoriteStatus === 'saving' ? '更新中…' : 'お気に入り'}
                </button>
                <button className="album-modal__comment-button" type="button" onClick={openComments}>
                  <CommentIcon />
                  コメント
                </button>
                {canEditTags && (
                  <button className="album-modal__tag-button" type="button" onClick={openTagEditor}>
                    <TagIcon />
                    タグを編集
                  </button>
                )}
              </div>
            </div>
          )}
          {favoriteError && <p className="album-modal__favorite-error" role="alert">{favoriteError}</p>}
          {visibilityError && <p className="album-modal__favorite-error" role="alert">{visibilityError}</p>}
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

        {isViewingComments && (
          <aside className="album-comment-panel" aria-label="写真のコメント">
            <div className="album-comment-panel__heading">
              <span>Photo comments</span>
              <button ref={closeButtonRef} type="button" onClick={() => setIsViewingComments(false)} aria-label="コメントを閉じる">×</button>
            </div>
            <CommentSection
              familyId={familyId}
              targetType="photo"
              targetId={photo.albumFileId}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

export default AlbumPhotoModal
