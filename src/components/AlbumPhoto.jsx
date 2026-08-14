import { useEffect, useState } from 'react'
import { getDrivePhotoUrl } from '../services/albumApi.js'

function AlbumPhoto({ photo, driveAccessToken, onOpen, style }) {
  const [imageUrl, setImageUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''

    getDrivePhotoUrl(driveAccessToken, photo, controller.signal)
      .then((url) => {
        objectUrl = url
        setImageUrl(url)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setFailed(true)
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
        {imageUrl && <img src={imageUrl} alt={photo.name} draggable="false" />}
        {!imageUrl && !failed && <span className="album-photo__placeholder" aria-label="読み込み中" />}
        {failed && <span className="album-photo__error">読み込めませんでした</span>}
        <span className="album-photo__caption">{photo.name}</span>
      </button>
    </div>
  )
}

export default AlbumPhoto
