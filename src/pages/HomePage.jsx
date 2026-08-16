const ROLE_LABELS = {
  member: 'メンバー',
  parent: '両親',
  admin: '管理者',
}

function HomePage({ session, onLogout, onNavigate }) {
  const activeFamily = session.families[0]

  const openAlbum = (event) => {
    event.preventDefault()
    onNavigate('/album')
  }

  return (
    <main className="page">
      <h1 className="page__title">Our Diary</h1>

      <section className="card" aria-labelledby="welcome-heading">
        {session.user.picture && (
          <img
            className="profile-avatar"
            src={session.user.picture}
            alt="プロフィール"
            referrerPolicy="no-referrer"
          />
        )}
        <p id="welcome-heading" className="welcome-text">
          ようこそ、{session.user.name} さん
        </p>
        <div className={`role-badge role-badge--${activeFamily.role}`}>
          {ROLE_LABELS[activeFamily.role] ?? activeFamily.role}
        </div>
        <p className="info-text">
          {activeFamily.name}のプライベート空間に安全に接続されています。
        </p>

        <a className="album-link" href="/album" onClick={openAlbum}>
          アルバムを見る
        </a>

        <a
          className="album-link home-diary-link"
          href="/diary"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('/diary')
          }}
        >
          日記カレンダーを見る
        </a>

        {['parent', 'admin'].includes(activeFamily.role) && (
          <>
            <a
              className="album-link home-milk-link"
              href="/milk"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/milk')
              }}
            >
              ミルクの記録を見る
            </a>
            <a
              className="album-settings-link"
              href="/diary/new"
              onClick={(event) => {
                event.preventDefault()
                onNavigate('/diary/new')
              }}
            >
              ＋ 新しい日記を書く
            </a>
          </>
        )}

        {activeFamily.role === 'admin' && (
          <a
            className="album-settings-link"
            href="/album/setup"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('/album/setup')
            }}
          >
            Google Driveアルバム設定
          </a>
        )}

        <button className="logout-button" type="button" onClick={onLogout}>
          ログアウト
        </button>
      </section>
    </main>
  )
}

export default HomePage
