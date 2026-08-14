import { useEffect, useState } from 'react'
import { getDriveOwnerInvitation } from '../services/albumApi.js'

function DriveOwnerConnectPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [invitation, setInvitation] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDriveOwnerInvitation(token)
      .then(setInvitation)
      .catch((requestError) => setError(requestError.message))
  }, [token])

  return (
    <main className="page">
      <h1 className="page__title page__title--small">Google Drive連携</h1>
      <section className="card owner-connect-card">
        {!invitation && !error && <p>招待情報を確認しています…</p>}
        {error && <div className="error-box">{error}</div>}
        {invitation && (
          <>
            <h2>{invitation.albumTitle}</h2>
            <p className="info-text">
              {invitation.familyName}のOur Diaryが、あなたのGoogle Drive内に写真用フォルダを作成します。
            </p>
            <dl className="owner-connect-details">
              <dt>使用するGoogleアカウント</dt>
              <dd>{invitation.email}</dd>
            </dl>
            <p className="owner-connect-note">
              次の画面では、必ず上記のGoogleアカウントを選択してください。
            </p>
            <a
              className="album-link"
              href={`/api/drive-owner-oauth-start?${new URLSearchParams({ token })}`}
            >
              Google Driveとの連携を承認
            </a>
          </>
        )}
      </section>
    </main>
  )
}

export default DriveOwnerConnectPage
