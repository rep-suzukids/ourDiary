import { useEffect, useState } from 'react'
import { getDrivePhotoUrl } from '../services/albumApi.js'

function AlbumPhoto({ photo, driveAccessToken, onOpen, style }) {
  const [imageUrl, setImageUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [failureMessage, setFailureMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    setFailed(false)
    setFailureMessage('')

    getDrivePhotoUrl(driveAccessToken, photo, controller.signal)
      .then((url) => {
        objectUrl = url
        setImageUrl(url)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setFailed(true)
          setFailureMessage(error.message)
        }
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [driveAccessToken, photo])

  return (
    <div className="album-photo-position" style={style}>
      <button
        type="button"
        className="album-photo"
        aria-label={`${photo.name}を拡大表示`}
        aria-disabled={!imageUrl}
        onClick={() => imageUrl && onOpen(photo, imageUrl)}
      >
        {imageUrl && !failed && (
          <img
            src={imageUrl}
            alt={photo.name}
            draggable="false"
            onError={() => {
              setFailed(true)
              setFailureMessage(`この画像形式を表示できません（${photo.mimeType || '形式不明'}）`)
            }}
          />
        )}
        {!imageUrl && !failed && <span className="album-photo__placeholder" aria-label="読み込み中" />}
        {failed && <span className="album-photo__error">{failureMessage || '読み込めませんでした'}</span>}
        {photo.tagIds?.length > 0 && (
          <span className="album-photo__tag-marker" aria-label="タグ設定済み" title="タグ設定済み">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5.5V11l8.1 8.1a2 2 0 0 0 2.8 0l4.2-4.2a2 2 0 0 0 0-2.8L11 4H5.5A1.5 1.5 0 0 0 4 5.5Z" />
              <circle cx="8" cy="8" r="1.2" />
            </svg>
          </span>
        )}
        <span className="album-photo__caption">{photo.name}</span>
      </button>
    </div>
  )
}

export default AlbumPhoto
