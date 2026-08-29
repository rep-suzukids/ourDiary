async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('予定APIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? '予定の処理に失敗しました。')
  return body
}

function requestHeaders(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getSchedules(familyId, year, month) {
  const query = new URLSearchParams({ year: String(year), month: String(month) })
  const response = await fetch(`/api/schedules?${query}`, {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function createSchedule(familyId, values) {
  const response = await fetch('/api/schedules', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function updateSchedule(familyId, values) {
  const response = await fetch('/api/schedules', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function deleteSchedule(familyId, id) {
  const response = await fetch('/api/schedules', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}
