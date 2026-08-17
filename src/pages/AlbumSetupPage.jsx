import { useState } from 'react'
import { createDriveOwnerInvitation } from '../services/albumApi.js'

function AlbumSetupPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState(`${activeFamily.name} Album`)
  const [invitation, setInvitation] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const goBack = (event) => {
    event.preventDefault()
    onNavigate('/album')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('submitting')
    setError('')
    try {
      const result = await createDriveOwnerInvitation(
        activeFamily.id,
        { email, title },
      )
      setInvitation(result)
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('idle')
    }
  }

  const copyInvitation = async () => {
    await navigator.clipboard.writeText(invitation.invitationUrl)
    setCopied(true)
  }

  return (
    <main className="page">
      <h1 className="page__title page__title--small">Google Driveアルバム作成</h1>
      <section className="card album-setup-card">
        {!invitation && (
          <form className="album-setup-form" onSubmit={handleSubmit}>
            <p className="info-text">
              アルバム用フォルダを所有する方のGoogleアカウントを指定します。発行したURLを、その方へ直接お伝えください。
            </p>
            <label>
              オーナーのGmailアドレス
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@gmail.com"
                required
              />
            </label>
            <label>
              Google Driveのフォルダ名
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength="500"
                required
              />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button className="album-link album-link--button" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? '発行しています…' : '招待URLを発行'}
            </button>
          </form>
        )}

        {invitation && (
          <div className="invitation-result">
            <h2>招待URLを発行しました</h2>
            <p className="info-text">
              このURLは{invitation.expiresInHours}時間有効です。メール送信機能はありませんので、LINEなど任意の方法でオーナー本人へ伝えてください。
            </p>
            <input type="text" value={invitation.invitationUrl} readOnly aria-label="招待URL" />
            <button className="album-link album-link--button" type="button" onClick={copyInvitation}>
              {copied ? 'コピーしました' : 'URLをコピー'}
            </button>
          </div>
        )}
        <a href="/album" onClick={goBack}>アルバムへ戻る</a>
      </section>
    </main>
  )
}

export default AlbumSetupPage
