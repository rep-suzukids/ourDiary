async function readResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'リアクションの処理に失敗しました。')
  return body
}

function headers(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getReactions(familyId, targetType, targetId) {
  const query = new URLSearchParams({ targetType, targetId })
  const response = await fetch(`/api/reactions?${query}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: headers(familyId),
  })
  return readResponse(response)
}

export async function toggleReaction(familyId, targetType, targetId, reactionKey) {
  const response = await fetch('/api/reactions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ targetType, targetId, reactionKey }),
  })
  return readResponse(response)
}
