async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? '検索キーワードの処理に失敗しました。')
  return body
}

function headers(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getSavedSearchKeywords(familyId) {
  const response = await fetch('/api/search-keywords', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: headers(familyId),
  })
  return readResponse(response)
}

export async function createSavedSearchKeyword(familyId, keyword) {
  const response = await fetch('/api/search-keywords', {
    method: 'POST',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ keyword }),
  })
  return readResponse(response)
}

export async function updateSavedSearchKeyword(familyId, id, keyword) {
  const response = await fetch('/api/search-keywords', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ id, keyword }),
  })
  return readResponse(response)
}

export async function reorderSavedSearchKeywords(familyId, ids) {
  const response = await fetch('/api/search-keywords', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ action: 'reorder', ids }),
  })
  return readResponse(response)
}

export async function deleteSavedSearchKeyword(familyId, id) {
  const response = await fetch('/api/search-keywords', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}
