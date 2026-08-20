async function readResponse(response) {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('タグAPIに接続できませんでした。開発サーバーを再起動してください。')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'タグの処理に失敗しました。')
  return body
}

function headers(familyId, includeJson = false) {
  return {
    'x-family-id': familyId,
    ...(includeJson && { 'Content-Type': 'application/json' }),
  }
}

export async function getTags(familyId) {
  const response = await fetch('/api/tags', {
    credentials: 'same-origin',
    headers: headers(familyId),
  })
  return readResponse(response)
}

export async function createTag(familyId, name) {
  const response = await fetch('/api/tags', {
    method: 'POST',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ name }),
  })
  return readResponse(response)
}

export async function updateTag(familyId, id, name) {
  const response = await fetch('/api/tags', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ id, name }),
  })
  return readResponse(response)
}

export async function deleteTag(familyId, id) {
  const response = await fetch('/api/tags', {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ id }),
  })
  return readResponse(response)
}

export async function updatePhotoTags(familyId, albumFileId, tagIds) {
  const response = await fetch('/api/photo-tags', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: headers(familyId, true),
    body: JSON.stringify({ albumFileId, tagIds }),
  })
  return readResponse(response)
}
