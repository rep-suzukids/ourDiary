import { useEffect, useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import InfiniteAlbumCanvas from '../components/InfiniteAlbumCanvas.jsx'
import {
  DRIVE_READ_SCOPES,
  getAlbumPhotos,
  loadDriveAccessToken,
  saveDriveAccessToken,
  verifyDriveAccount,
} from '../services/albumApi.js'
import '../Album.css'

function AlbumPage({ session, onNavigate }) {
  const [albumTitle, setAlbumTitle] = useState('Album')
  const [photos, setPhotos] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [driveAccessToken, setDriveAccessToken] = useState(() => loadDriveAccessToken('read', session.user.email))
  const activeFamily = session.families[0]

  const connectDrive = useGoogleLogin({
    scope: DRIVE_READ_SCOPES,
    include_granted_scopes: true,
    onSuccess: async (tokenResponse) => {
      try {
        await verifyDriveAccount(tokenResponse.access_token, session.user.email)
        saveDriveAccessToken('read', session.user.email, tokenResponse)
        setDriveAccessToken(tokenResponse.access_token)
        setError('')
      } catch (accountError) {
        setError(accountError.message)
      }
    },
    onError: () => setError('Google Driveへの接続がキャンセルされました。'),
  })

  useEffect(() => {
    let isActive = true
    getAlbumPhotos(session.credential, activeFamily.id)
      .then((album) => {
        if (!isActive) return
        setAlbumTitle(album.title)
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
  }, [activeFamily.id, session.credential])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
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
      {status === 'ready' && photos.length === 0 && (
        <div className="album-state">
          <p>Google Driveアルバムには写真がまだありません。</p>
          {['parent', 'admin'].includes(activeFamily.role) && (
            <a href="/album/upload" onClick={navigateLink('/album/upload')}>最初の写真を追加する</a>
          )}
        </div>
      )}
      {status === 'ready' && photos.length > 0 && !driveAccessToken && (
        <div className="album-state">
          <p>非公開の写真をGoogle Driveから直接表示するため、Google Driveへの読み取りアクセスを許可してください。</p>
          {error && <p className="upload-error">{error}</p>}
          <button className="album-link album-link--button" type="button" onClick={() => connectDrive()}>
            Google Driveに接続
          </button>
        </div>
      )}
      {status === 'ready' && photos.length > 0 && driveAccessToken && (
        <InfiniteAlbumCanvas photos={photos} driveAccessToken={driveAccessToken} />
      )}
    </main>
  )
}

export default AlbumPage
