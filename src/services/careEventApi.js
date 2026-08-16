async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('ミルク記録APIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'ミルク記録の処理に失敗しました。')
  return body
}

function requestHeaders(credential, familyId, includeJson = false) {
  return {
    Authorization: `Bearer ${credential}`,
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getCareEvents(credential, familyId, date) {
  const query = new URLSearchParams({ date })
  const response = await fetch(`/api/care-events?${query}`, {
    headers: requestHeaders(credential, familyId),
  })
  return readResponse(response)
}

export async function createCareEvent(credential, familyId, values) {
  const response = await fetch('/api/care-events', {
    method: 'POST',
    headers: requestHeaders(credential, familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function updateCareEvent(credential, familyId, values) {
  const response = await fetch('/api/care-events', {
    method: 'PATCH',
    headers: requestHeaders(credential, familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function deleteCareEvent(credential, familyId, id) {
  const response = await fetch('/api/care-events', {
    method: 'DELETE',
    headers: requestHeaders(credential, familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}
