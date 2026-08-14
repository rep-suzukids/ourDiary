import { useEffect, useRef } from 'react'

function AlbumPhotoModal({ photo, imageUrl, onClose }) {
  const closeButtonRef = useRef(null)

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="album-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.name}の拡大表示`}
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="album-modal__content" onClick={(event) => event.stopPropagation()}>
        <img src={imageUrl} alt={photo.name} />
        <button
          ref={closeButtonRef}
          type="button"
          className="album-modal__close"
          aria-label="拡大画像を閉じる"
          onClick={onClose}
        >
          ×
        </button>
        <p>{photo.name}</p>
      </div>
    </div>
  )
}

export default AlbumPhotoModal
