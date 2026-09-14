function HighlightedText({ text, query }) {
  const source = String(text ?? '')
  const keyword = String(query ?? '').trim()
  if (!keyword) return source

  const foldedSource = source.toLocaleLowerCase('ja-JP')
  const foldedKeyword = keyword.toLocaleLowerCase('ja-JP')
  const parts = []
  let cursor = 0
  let matchIndex = foldedSource.indexOf(foldedKeyword)

  while (matchIndex >= 0) {
    if (matchIndex > cursor) parts.push(source.slice(cursor, matchIndex))
    const end = matchIndex + keyword.length
    parts.push(<mark className="search-match" key={`${matchIndex}-${end}`}>{source.slice(matchIndex, end)}</mark>)
    cursor = end
    matchIndex = foldedSource.indexOf(foldedKeyword, cursor)
  }
  if (cursor < source.length) parts.push(source.slice(cursor))
  return parts.length > 0 ? parts : source
}

export default HighlightedText
