async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('おむつ記録APIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'おむつ記録の処理に失敗しました。')
  return body
}

export const BOWEL_STATUS_CHANGED_EVENT = 'ourdiary:bowel-status-changed'

function notifyBowelStatusChanged() {
  window.dispatchEvent(new Event(BOWEL_STATUS_CHANGED_EVENT))
}

function requestHeaders(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getBowelEvents(familyId, date) {
  const query = new URLSearchParams({ date })
  const response = await fetch(`/api/bowel-events?${query}`, {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function getMonthlyBowelSummary(familyId, year, month) {
  const query = new URLSearchParams({
    view: 'month',
    year: String(year),
    month: String(month),
  })
  const response = await fetch(`/api/bowel-events?${query}`, {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function getBowelReminderStatus(familyId) {
  const response = await fetch('/api/bowel-events?view=reminder', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function createBowelEvent(familyId, values) {
  const response = await fetch('/api/bowel-events', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify(values),
  })
  const result = await readResponse(response)
  notifyBowelStatusChanged()
  return result
}

export async function updateBowelEvent(familyId, values) {
  const response = await fetch('/api/bowel-events', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify(values),
  })
  const result = await readResponse(response)
  notifyBowelStatusChanged()
  return result
}

export async function deleteBowelEvent(familyId, id) {
  const response = await fetch('/api/bowel-events', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ id }),
  })
  const result = await readResponse(response)
  notifyBowelStatusChanged()
  return result
}
