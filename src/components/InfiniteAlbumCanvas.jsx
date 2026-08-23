import { useEffect, useMemo, useRef, useState } from 'react'
import AlbumPhoto from './AlbumPhoto.jsx'
import AlbumPhotoModal from './AlbumPhotoModal.jsx'

const MIN_SCALE = 0.45
const MAX_SCALE = 1.8
const CARD_WIDTH = 260
const CARD_HEIGHT = 190
const COLUMN_GAP = 0
const ROW_GAP = 0
const RADIANS_TO_DEGREES = 180 / Math.PI

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function InfiniteAlbumCanvas({
  photos,
  driveAccessToken,
  familyId,
  canEditTags,
  canManageTags,
  onPhotoTagsChange,
  onPhotoFavoriteChange,
}) {
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 })
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 720 : window.innerHeight,
  }))
  const drag = useRef(null)
  const suppressOpen = useRef(false)

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }

    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const placements = useMemo(() => {
    const columns = Math.max(3, Math.ceil(Math.sqrt(photos.length * 1.45)))
    const rows = Math.ceil(photos.length / columns)
    const totalWidth = columns * CARD_WIDTH + (columns - 1) * COLUMN_GAP
    const totalHeight = rows * CARD_HEIGHT + (rows - 1) * ROW_GAP

    return photos.map((photo, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = column * (CARD_WIDTH + COLUMN_GAP) - totalWidth / 2
      const y = row * (CARD_HEIGHT + ROW_GAP) - totalHeight / 2
      return {
        photo,
        x,
        y,
      }
    })
  }, [photos])

  const zoomAtCenter = (amount) => {
    setCamera((current) => ({ ...current, scale: clamp(current.scale + amount, MIN_SCALE, MAX_SCALE) }))
  }

  const handleWheel = (event) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const nextScale = clamp(camera.scale * Math.exp(-event.deltaY * 0.001), MIN_SCALE, MAX_SCALE)
    const cursorX = event.clientX - rect.left - rect.width / 2
    const cursorY = event.clientY - rect.top - rect.height / 2
    const ratio = nextScale / camera.scale

    setCamera({
      x: cursorX - (cursorX - camera.x) * ratio,
      y: cursorY - (cursorY - camera.y) * ratio,
      scale: nextScale,
    })
  }

  const handlePointerDown = (event) => {
    suppressOpen.current = false
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    }
  }

  const handlePointerMove = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.current.x
    const deltaY = event.clientY - drag.current.y
    const moved = drag.current.moved || Math.hypot(
      event.clientX - drag.current.startX,
      event.clientY - drag.current.startY,
    ) > 6

    if (moved && !drag.current.moved) event.currentTarget.setPointerCapture(event.pointerId)

    drag.current = {
      ...drag.current,
      x: event.clientX,
      y: event.clientY,
      moved,
    }
    if (moved) {
      setCamera((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }))
    }
  }

  const stopDragging = (event) => {
    if (drag.current?.pointerId !== event.pointerId) return
    suppressOpen.current = drag.current.moved
    drag.current = null
    setTimeout(() => {
      suppressOpen.current = false
    }, 0)
  }

  const handleOpenPhoto = (photo, imageUrl) => {
    if (suppressOpen.current) {
      suppressOpen.current = false
      return
    }

    setSelectedPhoto({ photo, imageUrl })
  }

  const handleTagsChange = (albumFileId, tagIds) => {
    onPhotoTagsChange(albumFileId, tagIds)
    setSelectedPhoto((current) => current ? {
      ...current,
      photo: { ...current.photo, tagIds },
    } : current)
  }

  const handleFavoriteChange = (albumFileId, isFavorite) => {
    onPhotoFavoriteChange(albumFileId, isFavorite)
    setSelectedPhoto((current) => current ? {
      ...current,
      photo: { ...current.photo, isFavorite },
    } : current)
  }

  return (
    <section
      className="album-canvas"
      aria-label="写真の無限キャンバス"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className="album-canvas__plane"
        style={{ transform: `translate(calc(50vw + ${camera.x}px), calc(50vh + ${camera.y}px)) scale(${camera.scale})` }}
      >
        {placements.map(({ photo, x, y }) => {
          const screenX = camera.x + (x + CARD_WIDTH / 2) * camera.scale
          const screenY = camera.y + (y + CARD_HEIGHT / 2) * camera.scale
          const radiusX = Math.max(viewport.width * 1.65, 900)
          const radiusY = Math.max(viewport.height * 2.2, 760)
          const angleX = clamp(screenX / radiusX, -1.15, 1.15)
          const angleY = clamp(screenY / radiusY, -1.15, 1.15)
          const curvedScreenX = radiusX * Math.sin(angleX)
          const curvedScreenY = radiusY * Math.sin(angleY)
          const curvedX = (curvedScreenX - camera.x) / camera.scale - CARD_WIDTH / 2
          const curvedY = (curvedScreenY - camera.y) / camera.scale - CARD_HEIGHT / 2
          const depth = (
            radiusX * (1 - Math.cos(angleX))
            + radiusY * (1 - Math.cos(angleY))
          ) / camera.scale
          const horizontalArc = CARD_WIDTH * camera.scale / radiusX
          const verticalArc = CARD_HEIGHT * camera.scale / radiusY
          const scaleX = Math.sin(horizontalArc / 2) / (horizontalArc / 2)
          const scaleY = Math.sin(verticalArc / 2) / (verticalArc / 2)

          return (
            <AlbumPhoto
              key={photo.id}
              photo={photo}
              driveAccessToken={driveAccessToken}
              onOpen={handleOpenPhoto}
              style={{
                transform: `translate3d(${curvedX}px, ${curvedY}px, ${depth}px) rotateY(${-angleX * RADIANS_TO_DEGREES}deg) rotateX(${angleY * RADIANS_TO_DEGREES}deg) scale(${scaleX}, ${scaleY})`,
              }}
            />
          )
        })}
      </div>

      {selectedPhoto && (
        <AlbumPhotoModal
          photo={selectedPhoto.photo}
          imageUrl={selectedPhoto.imageUrl}
          familyId={familyId}
          canEditTags={canEditTags}
          canManageTags={canManageTags}
          onTagsChange={handleTagsChange}
          onFavoriteChange={handleFavoriteChange}
          onClose={() => setSelectedPhoto(null)}
        />
      )}

      <div className="album-controls" aria-label="表示倍率の操作">
        <button type="button" onClick={() => zoomAtCenter(-0.15)} aria-label="縮小">−</button>
        <output>{Math.round(camera.scale * 100)}%</output>
        <button type="button" onClick={() => zoomAtCenter(0.15)} aria-label="拡大">＋</button>
        <button type="button" onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}>リセット</button>
      </div>
      <p className="album-canvas__hint">ドラッグして移動・ホイールで拡大縮小</p>
    </section>
  )
}

export default InfiniteAlbumCanvas
