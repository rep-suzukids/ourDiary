async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('体温記録APIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? '体温記録の処理に失敗しました。')
  return body
}

function requestHeaders(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getTemperatureEvents(familyId, date) {
  const query = new URLSearchParams({ date })
  const response = await fetch(`/api/temperature-events?${query}`, {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function getMonthlyTemperatureSummary(familyId, year, month) {
  const query = new URLSearchParams({
    view: 'month',
    year: String(year),
    month: String(month),
  })
  const response = await fetch(`/api/temperature-events?${query}`, {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function createTemperatureEvent(familyId, values) {
  const response = await fetch('/api/temperature-events', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function updateTemperatureEvent(familyId, values) {
  const response = await fetch('/api/temperature-events', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify(values),
  })
  return readResponse(response)
}

export async function deleteTemperatureEvent(familyId, id) {
  const response = await fetch('/api/temperature-events', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}
