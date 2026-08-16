async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('日記APIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? '日記の処理に失敗しました。')
  return body
}

function requestHeaders(credential, familyId, includeJson = false) {
  return {
    Authorization: `Bearer ${credential}`,
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getDiaryEntries(credential, familyId, year, month) {
  const query = new URLSearchParams({ year: String(year), month: String(month) })
  const response = await fetch(`/api/diary-entries?${query}`, {
    headers: requestHeaders(credential, familyId),
  })
  return readResponse(response)
}

export async function createDiaryEntry(credential, familyId, values) {
  const response = await fetch('/api/diary-entries', {
    method: 'POST',
    headers: requestHeaders(credential, familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function updateDiaryEntry(credential, familyId, values) {
  const response = await fetch('/api/diary-entries', {
    method: 'PATCH',
    headers: requestHeaders(credential, familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function deleteDiaryEntry(credential, familyId, id) {
  const response = await fetch('/api/diary-entries', {
    method: 'DELETE',
    headers: requestHeaders(credential, familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}
