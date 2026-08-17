async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error ?? 'アルバムを読み込めませんでした。')
    error.code = body.code
    throw error
  }
  return body
}

export async function getAlbumPhotos(familyId) {
  const response = await fetch('/api/album-files', {
    credentials: 'same-origin',
    headers: { 'x-family-id': familyId },
  })
  return readApiResponse(response)
}

export async function listDrivePhotosDirectly(accessToken, folderId) {
  const parameters = new URLSearchParams({
    q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    pageSize: '100',
    orderBy: 'createdTime desc',
    fields: 'files(id,name,mimeType,createdTime,size,imageMediaMetadata(width,height))',
  })
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${parameters}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error(`Google Driveの写真一覧を取得できませんでした（HTTP ${response.status}）`)
  const body = await response.json()
  return (body.files ?? [])
    .filter((file) => file.mimeType?.startsWith('image/'))
    .map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      createdTime: file.createdTime ?? null,
      size: file.size ?? null,
      width: file.imageMediaMetadata?.width ?? null,
      height: file.imageMediaMetadata?.height ?? null,
    }))
}

export async function registerDriveAlbumFiles(familyId, files) {
  const response = await fetch('/api/album-files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-family-id': familyId,
    },
    credentials: 'same-origin',
    body: JSON.stringify({ files }),
  })
  return readApiResponse(response)
}

export async function getDrivePhotoUrl(accessToken, photo, signal) {
  let response
  try {
    response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.id)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      },
    )
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Google Driveへの直接接続に失敗しました（通信またはCORS）')
  }

  if (!response.ok) {
    const messages = {
      401: 'Google Driveへの接続期限が切れました',
      403: 'Google Driveからこの写真の読み取りが許可されませんでした',
      404: 'Google Driveに写真が見つかりませんでした',
    }
    throw new Error(`${messages[response.status] ?? '写真を取得できませんでした'}（HTTP ${response.status}）`)
  }

  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error(`画像以外のデータを受信しました（${blob.type || '形式不明'}）`)
  }
  return URL.createObjectURL(blob)
}

export async function createDriveOwnerInvitation(familyId, values) {
  const response = await fetch('/api/drive-owner-invitations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-family-id': familyId,
    },
    credentials: 'same-origin',
    body: JSON.stringify(values),
  })
  return readApiResponse(response)
}

export async function getDriveOwnerInvitation(token) {
  const response = await fetch(`/api/drive-owner-invitation?${new URLSearchParams({ token })}`)
  return readApiResponse(response)
}

export async function getDriveAccessToken(familyId) {
  const response = await fetch('/api/drive-access-token', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'x-family-id': familyId },
  })
  return readApiResponse(response)
}

export function getDriveConnectUrl(familyId, returnTo) {
  return `/api/drive-user-oauth-start?${new URLSearchParams({ familyId, returnTo })}`
}

async function createDriveUploadSession(accessToken, folderId, file) {
  const parameters = new URLSearchParams({
    uploadType: 'resumable',
    fields: 'id,name,mimeType,createdTime,size,imageMediaMetadata(width,height)',
  })
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files?${parameters}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type,
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type,
      parents: [folderId],
      appProperties: { ourDiaryPhoto: 'true' },
    }),
  })
  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? 'Google Driveへの書き込みが許可されていません。再接続してください。'
      : 'アップロードの準備に失敗しました。')
  }
  const uploadUrl = response.headers.get('Location')
  if (!uploadUrl) throw new Error('Google Driveからアップロード先を取得できませんでした。')
  return uploadUrl
}

export async function uploadFileDirectlyToDrive(accessToken, folderId, file, onProgress) {
  const uploadUrl = await createDriveUploadSession(accessToken, folderId, file)
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', uploadUrl)
    request.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    request.setRequestHeader('Content-Type', file.type)
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        try {
          resolve(JSON.parse(request.responseText))
        } catch {
          resolve({ name: file.name })
        }
      } else {
        reject(new Error('Google Driveへの送信に失敗しました。'))
      }
    })
    request.addEventListener('error', () => reject(new Error('Google Driveへ接続できませんでした。')))
    request.send(file)
  })
}
