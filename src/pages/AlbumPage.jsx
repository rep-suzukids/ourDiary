import { useEffect, useRef, useState } from 'react'
import InfiniteAlbumCanvas from '../components/InfiniteAlbumCanvas.jsx'
import {
  getAlbumPhotos,
  getDriveAccessToken,
  getDriveConnectUrl,
  listDrivePhotosDirectly,
  registerDriveAlbumFiles,
} from '../services/albumApi.js'
import '../Album.css'

function AlbumPage({ session, onNavigate }) {
  const [albumTitle, setAlbumTitle] = useState('Album')
  const [folderId, setFolderId] = useState('')
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [driveAccessToken, setDriveAccessToken] = useState('')
  const [driveStatus, setDriveStatus] = useState('loading')
  const syncAttempted = useRef(false)
  const activeFamily = session.families[0]
  const canEditTags = ['parent', 'admin'].includes(activeFamily.role)

  useEffect(() => {
    let isActive = true
    getAlbumPhotos(activeFamily.id)
      .then((album) => {
        if (!isActive) return
        setAlbumTitle(album.title)
        setFolderId(album.folderId)
        setPhotos(album.photos)
        setStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(requestError.message)
        setErrorCode(requestError.code)
        setStatus('error')
      })
    return () => { isActive = false }
  }, [activeFamily.id])

  useEffect(() => {
    let isActive = true
    const oauthStatus = new URLSearchParams(window.location.search).get('drive')
    if (oauthStatus === 'failed') setError('Google Driveへの接続に失敗しました。')
    if (oauthStatus === 'email_mismatch') {
      setError(`${session.user.email}のGoogleアカウントを選択してください。`)
    }
    getDriveAccessToken(activeFamily.id)
      .then((driveAccess) => {
        if (!isActive) return
        setDriveAccessToken(driveAccess.accessToken)
        setDriveStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setDriveStatus(requestError.code === 'DRIVE_USER_NOT_CONNECTED' ? 'not-connected' : 'error')
        if (requestError.code !== 'DRIVE_USER_NOT_CONNECTED') setError(requestError.message)
      })
    return () => { isActive = false }
  }, [activeFamily.id, session.user.email])

  useEffect(() => {
    if (status !== 'ready' || photos.length > 0 || !folderId || !driveAccessToken || syncAttempted.current) return
    syncAttempted.current = true
    listDrivePhotosDirectly(driveAccessToken, folderId)
      .then((drivePhotos) => {
        if (drivePhotos.length === 0) return null
        return registerDriveAlbumFiles(activeFamily.id, drivePhotos)
      })
      .then((result) => {
        if (result?.photos) setPhotos(result.photos)
      })
      .catch((syncError) => setError(syncError.message))
  }, [activeFamily.id, driveAccessToken, folderId, photos.length, status])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const updatePhotoTags = (albumFileId, tagIds) => {
    setPhotos((current) => current.map((photo) => (
      photo.albumFileId === albumFileId ? { ...photo, tagIds } : photo
    )))
  }

  return (
    <main className="album-page">
      <header className="album-header">
        <a className="album-header__back" href="/" onClick={navigateLink('/')} aria-label="TOPへ戻る">←</a>
        <div>
          <p className="album-header__eyebrow">{activeFamily.name}</p>
          <h1>{albumTitle}</h1>
        </div>
        {status === 'ready' && <span className="album-header__count">{photos.length} photos</span>}
      </header>

      {['parent', 'admin'].includes(activeFamily.role) && status === 'ready' && (
        <a className="album-upload-link" href="/album/upload" onClick={navigateLink('/album/upload')}>
          ＋ 写真を追加
        </a>
      )}

      {status === 'loading' && <div className="album-state">写真を読み込んでいます…</div>}
      {status === 'error' && (
        <div className="album-state album-state--error">
          <p>{error}</p>
          {errorCode === 'ALBUM_NOT_CONNECTED' && activeFamily.role === 'admin' && (
            <a href="/album/setup" onClick={navigateLink('/album/setup')}>アルバムを作成する</a>
          )}
        </div>
      )}
      {status === 'ready' && photos.length === 0 && driveAccessToken && (
        <div className="album-state">
          <p>Google Driveアルバムには写真がまだありません。</p>
          {error && <p className="upload-error">{error}</p>}
          {['parent', 'admin'].includes(activeFamily.role) && (
            <a href="/album/upload" onClick={navigateLink('/album/upload')}>最初の写真を追加する</a>
          )}
        </div>
      )}
      {status === 'ready' && driveStatus === 'loading' && (
        <div className="album-state">Google Driveへの接続を確認しています…</div>
      )}
      {status === 'ready' && driveStatus === 'not-connected' && (
        <div className="album-state">
          <p>初回のみGoogle Driveへのアクセスを許可してください。次回からは自動的に接続します。</p>
          {error && <p className="upload-error">{error}</p>}
          <a className="album-link album-link--button" href={getDriveConnectUrl(activeFamily.id, '/album')}>
            Google Driveに接続
          </a>
        </div>
      )}
      {status === 'ready' && driveStatus === 'error' && (
        <div className="album-state album-state--error">{error}</div>
      )}
      {status === 'ready' && photos.length > 0 && driveAccessToken && (
        <InfiniteAlbumCanvas
          photos={photos}
          driveAccessToken={driveAccessToken}
          familyId={activeFamily.id}
          canEditTags={canEditTags}
          canManageTags={activeFamily.role === 'admin'}
          onPhotoTagsChange={updatePhotoTags}
        />
      )}
    </main>
  )
}

export default AlbumPage
