async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'コメントの処理に失敗しました。')
  return body
}

function headers(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getComments(familyId, targetType, targetId) {
  const query = new URLSearchParams({ targetType, targetId })
  const response = await fetch(`/api/comments?${query}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: headers(familyId),
  })
  return readResponse(response)
}

export async function createComment(familyId, targetType, targetId, text) {
  const response = await fetch('/api/comments', {
    method: 'POST',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ targetType, targetId, text }),
  })
  return readResponse(response)
}

export async function updateComment(familyId, id, text) {
  const response = await fetch('/api/comments', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ id, text }),
  })
  return readResponse(response)
}

export async function deleteComment(familyId, id) {
  const response = await fetch('/api/comments', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}
