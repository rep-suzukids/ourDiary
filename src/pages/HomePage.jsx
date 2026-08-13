function HomePage({ user, onLogout }) {
  return (
    <main className="page">
      <h1 className="page__title">Our Diary ❤️</h1>

      <section className="card" aria-labelledby="welcome-heading">
        <img className="profile-avatar" src={user.picture} alt="プロフィール" />
        <p id="welcome-heading" className="welcome-text">
          ようこそ、{user.name} さん
        </p>
        <p className="info-text">
          お二人のプライベート空間に安全に接続されています。
        </p>

        <div className="placeholder-box">
          ここに次回の「日記投稿・閲覧機能」を作っていきます！
        </div>

        <button className="logout-button" type="button" onClick={onLogout}>
          ログアウト
        </button>
      </section>
    </main>
  )
}

export default HomePage
