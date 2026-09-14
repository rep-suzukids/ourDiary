async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? '検索処理に失敗しました。')
  return body
}

export async function searchDiary(familyId, query, offset = 0) {
  const parameters = new URLSearchParams({
    scope: 'diary',
    q: query,
    offset: String(offset),
  })
  const response = await fetch(`/api/search?${parameters}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'x-family-id': familyId },
  })
  return readResponse(response)
}
