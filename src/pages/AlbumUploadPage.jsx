import { useEffect, useRef, useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import {
  DRIVE_WRITE_SCOPES,
  getAlbumPhotos,
  loadDriveAccessToken,
  registerDriveAlbumFiles,
  saveDriveAccessToken,
  uploadFileDirectlyToDrive,
  verifyDriveAccount,
} from '../services/albumApi.js'

const MAX_FILES = 10
const ACCEPTED_IMAGES = 'image/avif,image/bmp,image/gif,image/heic,image/heif,image/jpeg,image/png,image/tiff,image/webp'

function AlbumUploadPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [folderId, setFolderId] = useState('')
  const [items, setItems] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [driveAccessToken, setDriveAccessToken] = useState(() => loadDriveAccessToken('write', session.user.email))
  const previewUrls = useRef([])

  const connectDrive = useGoogleLogin({
    scope: DRIVE_WRITE_SCOPES,
    include_granted_scopes: true,
    onSuccess: async (tokenResponse) => {
      try {
        await verifyDriveAccount(tokenResponse.access_token, session.user.email)
        saveDriveAccessToken('write', session.user.email, tokenResponse)
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
        if (isActive) setFolderId(album.folderId)
      })
      .catch((requestError) => {
        if (isActive) setError(requestError.message)
      })
    return () => { isActive = false }
  }, [activeFamily.id, session.credential])

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
  }, [])

  const navigateLink = (path) => (event) => {
    event.preventDefault()
    onNavigate(path)
  }

  const handleFiles = (event) => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url)
    const selectedFiles = [...event.target.files]
    const validFiles = selectedFiles
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, MAX_FILES)
    previewUrls.current = validFiles.map((file) => URL.createObjectURL(file))
    setItems(validFiles.map((file, index) => ({
      file,
      previewUrl: previewUrls.current[index],
      status: 'ready',
      progress: 0,
      message: '',
    })))
    setError(selectedFiles.length > MAX_FILES
      ? `一度に選択できるのは${MAX_FILES}枚までです。`
      : '')
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
        updateItem(index, { uploadedFile, message: 'アルバムへ登録中' })
        await registerDriveAlbumFiles(session.credential, activeFamily.id, [uploadedFile])
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

        {!driveAccessToken && (
          <button className="album-link album-link--button" type="button" onClick={() => connectDrive()}>
            Google Driveに接続
          </button>
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
              <li key={`${item.file.name}-${item.file.lastModified}`} className={`upload-item upload-item--${item.status}`}>
                <img src={item.previewUrl} alt="" />
                <div className="upload-item__detail">
                  <strong>{item.file.name}</strong>
                  <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
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
            disabled={!folderId || items.length === 0 || isUploading || successCount === items.length}
            onClick={handleUpload}
          >
            {isUploading ? 'アップロードしています…' : `${items.length}枚をアップロード`}
          </button>
        )}
        <a href="/album" onClick={navigateLink('/album')}>アルバムへ戻る</a>
      </section>
    </main>
  )
}

export default AlbumUploadPage
