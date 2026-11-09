import { useEffect, useState } from 'react'
import HighlightedText from '../components/HighlightedText.jsx'
import { searchAll } from '../services/searchApi.js'
import { getSavedSearchKeywords } from '../services/searchKeywordApi.js'
import '../Search.css'

function initialParameters() {
  const parameters = new URLSearchParams(window.location.search)
  const requestedReturnTo = parameters.get('returnTo') ?? ''
  return {
    query: parameters.get('q')?.trim() ?? '',
    returnTo: requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : '/',
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

const RESULT_LABELS = {
  diary: '日記本文',
  diary_comment: '日記コメント',
  photo_comment: '写真コメント',
  milk_memo: 'ミルク',
  pumping_memo: '搾乳',
  diaper_memo: 'おむつ',
  temperature_memo: '検温',
  timeline_note: 'その他',
  medication_memo: 'おくすり',
  schedule: '予定',
}

function childTone(subjectName) {
  if (String(subjectName).includes('智') || String(subjectName).includes('とも')) return 'tomo'
  if (String(subjectName).includes('結') || String(subjectName).includes('ゆう')) return 'yuu'
  return 'both'
}

function resultPath(result, query) {
  const parameters = new URLSearchParams({ q: query })
  if (result.type === 'diary' || result.type === 'diary_comment') {
    parameters.set('date', result.date)
    parameters.set('focus', `${result.type === 'diary_comment' ? 'comment' : 'entry'}:${result.id}`)
    return `/diary?${parameters}`
  }
  if (result.type === 'photo_comment') {
    parameters.set('photo', result.parentId)
    parameters.set('comment', result.id)
    return `/album?${parameters}`
  }
  if (result.type === 'schedule') {
    parameters.set('date', result.date)
    parameters.set('focus', result.id)
    return `/schedule?${parameters}`
  }
  if (result.type === 'pumping_memo') {
    parameters.set('date', result.date)
    parameters.set('tab', 'pumping')
    parameters.set('focus', result.id)
    return `/milk?${parameters}`
  }

  const recordTypes = {
    milk_memo: 'milk',
    diaper_memo: 'poop',
    temperature_memo: 'temperature',
    timeline_note: 'note',
    medication_memo: 'medication',
  }
  parameters.set('date', result.date)
  parameters.set('child', childTone(result.subjectName))
  parameters.set('focus', `${recordTypes[result.type]}:${result.id}`)
  return `/timeline?${parameters}`
}

function SearchPage({ session, onNavigate }) {
  const activeFamily = session.families[0]
  const initial = initialParameters()
  const [input, setInput] = useState(initial.query)
  const [query, setQuery] = useState(initial.query)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [savedKeywords, setSavedKeywords] = useState([])
  const [keywordError, setKeywordError] = useState('')
  const [searchRevision, setSearchRevision] = useState(0)
  const [status, setStatus] = useState(initial.query ? 'loading' : 'idle')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getSavedSearchKeywords(activeFamily.id)
      .then((result) => {
        if (active) setSavedKeywords(result.keywords ?? [])
      })
      .catch((requestError) => {
        if (active) setKeywordError(requestError.message)
      })
    return () => { active = false }
  }, [activeFamily.id])

  useEffect(() => {
    if (!query) return undefined
    let active = true
    setStatus('loading')
    setError('')
    searchAll(activeFamily.id, query)
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
  }, [activeFamily.id, query, searchRevision])

  const runSearch = (value) => {
    const nextQuery = value.trim()
    setInput(nextQuery)
    if (!nextQuery) {
      setQuery('')
      setResults([])
      setTotal(0)
      setHasMore(false)
      setStatus('idle')
      return
    }
    const parameters = new URLSearchParams({ scope: 'all', q: nextQuery })
    if (initial.returnTo !== '/') parameters.set('returnTo', initial.returnTo)
    window.history.replaceState({}, '', `/search?${parameters}`)
    setQuery(nextQuery)
    setSearchRevision((current) => current + 1)
  }

  const submit = (event) => {
    event.preventDefault()
    runSearch(input)
  }

  const loadMore = async () => {
    setStatus('loading-more')
    setError('')
    try {
      const result = await searchAll(activeFamily.id, query, results.length)
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
    onNavigate(resultPath(result, query))
  }

  return (
    <main className="search-page">
      <header className="search-page__header">
        <a href={initial.returnTo} onClick={(event) => { event.preventDefault(); onNavigate(initial.returnTo) }} aria-label="前の画面へ戻る">←</a>
        <div>
          <p>Find memories</p>
          <h1>思い出を検索</h1>
        </div>
      </header>

      <section className="search-panel">
        <form className="search-form" onSubmit={submit} role="search">
          <label>
            <span className="visually-hidden">記録とコメントを検索</span>
            <SearchIcon />
            <input
              type="search"
              value={input}
              maxLength="100"
              placeholder="記録やコメントの言葉を入力"
              onChange={(event) => setInput(event.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" disabled={!input.trim() || status === 'loading'}>検索</button>
        </form>
        {savedKeywords.length > 0 && (
          <div className="search-quick-keywords" aria-label="よく使う検索キーワード">
            <span>よく使うワード</span>
            <div>
              {savedKeywords.map((item) => (
                <button type="button" key={item.id} onClick={() => runSearch(item.keyword)}>
                  {item.keyword}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="search-panel__hint">日記、写真コメント、育児記録のメモなどから言葉を探せます。</p>
        {keywordError && <p className="search-panel__keyword-error" role="status">よく使うワードを読み込めませんでした。</p>}
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
          <p className="search-results__empty">「{query}」を含む記録やコメントは見つかりませんでした。</p>
        )}
        <div className="search-results__list">
          {results.map((result) => {
            const path = resultPath(result, query)
            return (
              <a className="search-result-card" href={path} onClick={openResult(result)} key={`${result.type}-${result.id}`}>
                <div className="search-result-card__meta">
                  <time dateTime={result.date}>{formatDate(result.date)}</time>
                  <span>{result.subjectName}</span>
                  <small>{RESULT_LABELS[result.type] ?? '記録'}</small>
                </div>
                <p><HighlightedText text={result.snippet} query={query} /></p>
                <footer>
                  {result.type.endsWith('_comment') && <span>{result.authorName}</span>}
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
