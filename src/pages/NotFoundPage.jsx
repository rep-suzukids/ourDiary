function NotFoundPage({ onNavigate }) {
  const goHome = (event) => {
    event.preventDefault()
    onNavigate('/')
  }

  return (
    <main className="not-found-page">
      <p className="not-found-page__code">404</p>
      <h1>ページが見つかりません</h1>
      <p>URLが正しくないか、このページを表示する権限がありません。</p>
      <a href="/" onClick={goHome}>TOPへ戻る</a>
    </main>
  )
}

export default NotFoundPage
