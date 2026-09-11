import { useEffect, useRef, useState } from 'react'
import {
  getAlbumPhotos,
  getDriveAccessToken,
  getDriveConnectUrl,
  registerDriveAlbumFiles,
  uploadFileDirectlyToDrive,
} from '../services/albumApi.js'

const MAX_FILES = 10
const THUMBNAIL_SIZE = 180
const ACCEPTED_IMAGES = 'image/avif,image/bmp,image/gif,image/heic,image/heif,image/jpeg,image/png,image/tiff,image/webp'

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('プレビューを作成できませんでした。'))
    image.src = url
  })
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('プレビューを作成できませんでした。'))
    }, 'image/jpeg', 0.72)
  })
}

async function createThumbnailUrl(file) {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(sourceUrl)
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('プレビューを作成できませんでした。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.src = ''
    return URL.createObjectURL(await canvasToBlob(canvas))
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function AlbumUploadPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [folderId, setFolderId] = useState('')
  const [items, setItems] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [error, setError] = useState('')
  const [driveAccessToken, setDriveAccessToken] = useState('')
  const [driveStatus, setDriveStatus] = useState('loading')
  const [canReconnectDrive, setCanReconnectDrive] = useState(false)
  const previewUrls = useRef([])
  const selectionVersion = useRef(0)

  useEffect(() => {
    let isActive = true
    getAlbumPhotos(activeFamily.id)
      .then((album) => {
        if (isActive) setFolderId(album.folderId)
      })
      .catch((requestError) => {
        if (isActive) setError(requestError.message)
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
    getDriveAccessToken(activeFamily.id, 'upload')
      .then((driveAccess) => {
        if (!isActive) return
        setDriveAccessToken(driveAccess.accessToken)
        setDriveStatus('ready')
      })
      .catch((requestError) => {
        if (!isActive) return
        setDriveStatus(requestError.code === 'DRIVE_USER_NOT_CONNECTED'
          ? 'not-connected'
          : requestError.code === 'DRIVE_USER_RECONNECT_REQUIRED'
            ? 'reconnect-required'
            : 'error')
        setCanReconnectDrive(Boolean(requestError.canReconnect))
        if (requestError.code !== 'DRIVE_USER_NOT_CONNECTED') setError(requestError.message)
      })
    return () => { isActive = false }
  }, [activeFamily.id, session.user.email])

  useEffect(() => () => {
    selectionVersion.current += 1
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
  }, [])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const handleFiles = async (event) => {
    const version = selectionVersion.current + 1
    selectionVersion.current = version
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
    previewUrls.current = []
    const selectedFiles = [...event.target.files]
    const validFiles = selectedFiles
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, MAX_FILES)
    setItems(validFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      previewUrl: '',
      status: 'ready',
      progress: 0,
      message: '',
    })))
    setError(selectedFiles.length > MAX_FILES
      ? `一度に選択できるのは${MAX_FILES}枚までです。`
      : '')
    setIsPreparing(validFiles.length > 0)

    for (const [index, file] of validFiles.entries()) {
      try {
        const previewUrl = await createThumbnailUrl(file)
        if (selectionVersion.current !== version) {
          URL.revokeObjectURL(previewUrl)
          return
        }
        previewUrls.current.push(previewUrl)
        updateItem(index, { previewUrl })
      } catch {
        // A thumbnail is optional. Keep the original File only for the upload itself.
      }
    }
    if (selectionVersion.current === version) setIsPreparing(false)
  }

  const updateItem = (index, changes) => {
    setItems((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...changes } : item
    )))
  }

  const handleUpload = async () => {
    if (!driveAccessToken || !folderId || items.length === 0) return
    setIsUploading(true)
    setError('')
    let failedCount = 0

    for (const [index, item] of items.entries()) {
      if (item.status === 'success') continue
      try {
        updateItem(index, { status: 'uploading', message: 'Google Driveへ直接送信中' })
        const uploadedFile = item.uploadedFile ?? await uploadFileDirectlyToDrive(
          driveAccessToken, folderId, item.file,
          (progress) => updateItem(index, { progress }),
        )
        updateItem(index, { file: null, uploadedFile, message: 'アルバムへ登録中' })
        await registerDriveAlbumFiles(activeFamily.id, [uploadedFile])
        updateItem(index, { status: 'success', progress: 100, message: '完了' })
      } catch (uploadError) {
        failedCount += 1
        updateItem(index, { status: 'error', message: uploadError.message })
      }
    }

    setIsUploading(false)
    if (failedCount > 0) setError(`${failedCount}枚のアップロードに失敗しました。`)
  }

  const successCount = items.filter((item) => item.status === 'success').length

  return (
    <main className="page upload-page">
      <h1 className="page__title page__title--small">写真を追加</h1>
      <section className="card upload-card">
        <p className="info-text">
          写真はブラウザからGoogle Driveへ直接送信されます。Vercel Functionには写真データを送信しません。
        </p>

        {driveStatus === 'loading' && <p className="info-text">Google Driveへの接続を確認しています…</p>}

        {driveStatus === 'not-connected' && (
          <a className="album-link album-link--button" href={getDriveConnectUrl(activeFamily.id, '/album/upload')}>
            Google Driveに接続
          </a>
        )}

        {driveStatus === 'reconnect-required' && canReconnectDrive && (
          <div>
            <p className="info-text">現在Our Diaryへログインしている、ご自身のGoogleアカウントを選択してください。</p>
            <a className="album-link album-link--button" href={getDriveConnectUrl(activeFamily.id, '/album/upload')}>
              Google Driveへ再接続する
            </a>
          </div>
        )}

        {driveAccessToken && (
          <label className="file-picker">
            <span>写真を選択</span>
            <input type="file" accept={ACCEPTED_IMAGES} multiple disabled={isUploading} onChange={handleFiles} />
          </label>
        )}

        {items.length > 0 && (
          <ul className="upload-list">
            {items.map((item) => (
              <li key={`${item.name}-${item.lastModified}`} className={`upload-item upload-item--${item.status}`}>
                {item.previewUrl
                  ? <img src={item.previewUrl} alt="" />
                  : <span className="upload-item__placeholder" aria-hidden="true">写真</span>}
                <div className="upload-item__detail">
                  <strong>{item.name}</strong>
                  <span>{(item.size / 1024 / 1024).toFixed(1)} MB</span>
                  {item.status === 'uploading' && <progress max="100" value={item.progress} />}
                  {item.message && <small>{item.message}</small>}
                </div>
                <output>{item.status === 'success' ? '✓' : item.status === 'error' ? '!' : ''}</output>
              </li>
            ))}
          </ul>
        )}

        {error && <div className="error-box upload-error">{error}</div>}
        {items.length > 0 && successCount === items.length && (
          <div className="upload-success">すべての写真を追加しました。</div>
        )}
        {driveAccessToken && (
          <button
            className="album-link album-link--button"
            type="button"
            disabled={!folderId || items.length === 0 || isPreparing || isUploading || successCount === items.length}
            onClick={handleUpload}
          >
            {isPreparing
              ? '写真を準備しています…'
              : isUploading
                ? 'アップロードしています…'
                : `${items.length}枚をアップロード`}
          </button>
        )}
        <a href="/album" onClick={navigateLink('/album')}>アルバムへ戻る</a>
      </section>
    </main>
  )
}

export default AlbumUploadPage
