import { useEffect, useState } from 'react'
import HighlightedText from '../components/HighlightedText.jsx'
import { searchDiary } from '../services/searchApi.js'
import '../Search.css'

function initialParameters() {
  const parameters = new URLSearchParams(window.location.search)
  const requestedReturnTo = parameters.get('returnTo') ?? ''
  return {
    query: parameters.get('q')?.trim() ?? '',
    returnTo: requestedReturnTo.startsWith('/diary') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : '/diary',
  }
}

function formatDate(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return `${year}年${month}月${day}日`
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function SearchPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const initial = initialParameters()
  const [input, setInput] = useState(initial.query)
  const [query, setQuery] = useState(initial.query)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [status, setStatus] = useState(initial.query ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query) return undefined
    let active = true
    setStatus('loading')
    setError('')
    searchDiary(activeFamily.id, query)
      .then((result) => {
        if (!active) return
        setResults(result.results ?? [])
        setTotal(result.total ?? 0)
        setHasMore(Boolean(result.hasMore))
        setStatus('ready')
        const savedScroll = Number(sessionStorage.getItem('ourdiary-search-scroll'))
        if (Number.isFinite(savedScroll)) {
          sessionStorage.removeItem('ourdiary-search-scroll')
          requestAnimationFrame(() => window.scrollTo({ top: savedScroll }))
        }
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError.message)
        setStatus('error')
      })
    return () => { active = false }
  }, [activeFamily.id, query])

  const submit = (event) => {
    event.preventDefault()
    const nextQuery = input.trim()
    if (!nextQuery) {
      setQuery('')
      setResults([])
      setTotal(0)
      setHasMore(false)
      setStatus('idle')
      return
    }
    const parameters = new URLSearchParams({ scope: 'diary', q: nextQuery })
    if (initial.returnTo !== '/diary') parameters.set('returnTo', initial.returnTo)
    window.history.replaceState({}, '', `/search?${parameters}`)
    setQuery(nextQuery)
  }

  const loadMore = async () => {
    setStatus('loading-more')
    setError('')
    try {
      const result = await searchDiary(activeFamily.id, query, results.length)
      setResults((current) => [...current, ...(result.results ?? [])])
      setTotal(result.total ?? total)
      setHasMore(Boolean(result.hasMore))
      setStatus('ready')
    } catch (requestError) {
      setError(requestError.message)
      setStatus('ready')
    }
  }

  const openResult = (result) => (event) => {
    event.preventDefault()
    sessionStorage.setItem('ourdiary-search-scroll', String(window.scrollY))
    const focus = `${result.type === 'comment' ? 'comment' : 'entry'}:${result.id}`
    onNavigate(`/diary?date=${encodeURIComponent(result.date)}&focus=${encodeURIComponent(focus)}&q=${encodeURIComponent(query)}`)
  }

  return (
    <main className="search-page">
      <header className="search-page__header">
        <a href={initial.returnTo} onClick={(event) => { event.preventDefault(); onNavigate(initial.returnTo) }} aria-label="日記へ戻る">←</a>
        <div>
          <p>Find memories</p>
          <h1>日記を検索</h1>
        </div>
      </header>

      <section className="search-panel">
        <form className="search-form" onSubmit={submit} role="search">
          <label>
            <span className="visually-hidden">日記とコメントを検索</span>
            <SearchIcon />
            <input
              type="search"
              value={input}
              maxLength="100"
              placeholder="日記やコメントの言葉を入力"
              onChange={(event) => setInput(event.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" disabled={!input.trim() || status === 'loading'}>検索</button>
        </form>
        <p className="search-panel__hint">日記本文とコメントから、思い出の言葉を探せます。</p>
      </section>

      <section className="search-results" aria-live="polite">
        {query && status !== 'loading' && (
          <header className="search-results__heading">
            <h2>検索結果</h2>
            <span>{total}件</span>
          </header>
        )}
        {status === 'idle' && <p className="search-results__empty">探したい言葉を入力してください。</p>}
        {status === 'loading' && <p className="search-results__empty">思い出を探しています…</p>}
        {status === 'error' && <p className="search-results__error" role="alert">{error}</p>}
        {status !== 'loading' && query && results.length === 0 && status !== 'error' && (
          <p className="search-results__empty">「{query}」を含む日記やコメントは見つかりませんでした。</p>
        )}
        <div className="search-results__list">
          {results.map((result) => {
            const focus = `${result.type === 'comment' ? 'comment' : 'entry'}:${result.id}`
            const path = `/diary?date=${encodeURIComponent(result.date)}&focus=${encodeURIComponent(focus)}&q=${encodeURIComponent(query)}`
            return (
              <a className="search-result-card" href={path} onClick={openResult(result)} key={`${result.type}-${result.id}`}>
                <div className="search-result-card__meta">
                  <time dateTime={result.date}>{formatDate(result.date)}</time>
                  <span>{result.subjectName}</span>
                  <small>{result.type === 'comment' ? 'コメント' : '日記本文'}</small>
                </div>
                <p><HighlightedText text={result.snippet} query={query} /></p>
                <footer>
                  {result.type === 'comment' && <span>{result.authorName}</span>}
                  <span aria-hidden="true">›</span>
                </footer>
              </a>
            )
          })}
        </div>
        {hasMore && (
          <button className="search-results__more" type="button" onClick={loadMore} disabled={status === 'loading-more'}>
            {status === 'loading-more' ? '読み込み中…' : 'さらに表示'}
          </button>
        )}
        {error && status !== 'error' && <p className="search-results__error" role="alert">{error}</p>}
      </section>
    </main>
  )
}

export default SearchPage
