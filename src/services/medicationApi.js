async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('おくすりAPIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'おくすりの処理に失敗しました。')
  return body
}

function requestHeaders(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export const MEDICATION_STATUS_CHANGED_EVENT = 'ourdiary:medication-status-changed'

function notifyMedicationStatusChanged() {
  window.dispatchEvent(new Event(MEDICATION_STATUS_CHANGED_EVENT))
}

export async function getMedicationManagement(familyId) {
  const response = await fetch('/api/medications?view=management', {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function getMedicationDay(familyId, date, view = 'day') {
  const query = new URLSearchParams({ view, date })
  const response = await fetch(`/api/medications?${query}`, {
    credentials: 'same-origin',
    headers: requestHeaders(familyId),
  })
  return readResponse(response)
}

export async function createMedication(familyId, values) {
  const response = await fetch('/api/medications', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ resource: 'medication', ...values }),
  })
  const result = await readResponse(response)
  notifyMedicationStatusChanged()
  return result
}

export async function updateMedication(familyId, values) {
  const response = await fetch('/api/medications', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ resource: 'medication', ...values }),
  })
  const result = await readResponse(response)
  notifyMedicationStatusChanged()
  return result
}

export async function setMedicationActive(familyId, id, isActive) {
  return updateMedication(familyId, { id, action: 'setActive', isActive })
}

export async function createMedicationAdministration(familyId, values) {
  const response = await fetch('/api/medications', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ resource: 'administration', ...values }),
  })
  const result = await readResponse(response)
  notifyMedicationStatusChanged()
  return result
}

export async function updateMedicationAdministration(familyId, values) {
  const response = await fetch('/api/medications', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ resource: 'administration', ...values }),
  })
  const result = await readResponse(response)
  notifyMedicationStatusChanged()
  return result
}

export async function deleteMedicationAdministration(familyId, id) {
  const response = await fetch('/api/medications', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: requestHeaders(familyId, true),
    body: JSON.stringify({ resource: 'administration', id }),
  })
  const result = await readResponse(response)
  notifyMedicationStatusChanged()
  return result
}
