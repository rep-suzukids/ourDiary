async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error ?? 'アルバムを読み込めませんでした。')
    error.code = body.code
    error.canReconnect = Boolean(body.canReconnect)
    error.ownerEmail = body.ownerEmail ?? ''
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
    fields: 'files(id,name,mimeType,createdTime,size,imageMediaMetadata(width,height,time))',
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
      capturedTime: file.imageMediaMetadata?.time ?? null,
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

export async function updatePhotoFavorite(familyId, albumFileId, isFavorite) {
  const response = await fetch('/api/photo-favorite', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-family-id': familyId,
    },
    body: JSON.stringify({ albumFileId, isFavorite }),
  })
  return readApiResponse(response)
}

export async function updatePhotoVisibility(familyId, albumFileId, isPublished) {
  const response = await fetch('/api/photo-visibility', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-family-id': familyId,
    },
    body: JSON.stringify({ albumFileId, isPublished }),
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
        cache: 'no-store',
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

export async function getDriveAccessToken(familyId, purpose = 'read') {
  const response = await fetch(`/api/drive-access-token?${new URLSearchParams({ purpose })}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'x-family-id': familyId },
  })
  return readApiResponse(response)
}

export function getDriveConnectUrl(familyId, returnTo) {
  return `/api/drive-user-oauth-start?${new URLSearchParams({ familyId, returnTo })}`
}

const RESUMABLE_CHUNK_SIZE = 2 * 1024 * 1024
const MAX_UPLOAD_ATTEMPTS = 3
const FILE_FIELDS = 'id,name,mimeType,createdTime,size,imageMediaMetadata(width,height,time)'

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function parseDriveFile(responseText, fallbackName) {
  try {
    return JSON.parse(responseText)
  } catch {
    return { name: fallbackName }
  }
}

function createUploadError(message, { status = 0, retryable = false } = {}) {
  const error = new Error(message)
  error.status = status
  error.retryable = retryable
  return error
}

function sendUploadRequest({ method, url, headers, body, onProgress }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, url)
    for (const [name, value] of Object.entries(headers ?? {})) {
      request.setRequestHeader(name, value)
    }
    if (onProgress) {
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total)
      })
    }
    request.addEventListener('load', () => resolve({
      status: request.status,
      responseText: request.responseText,
      range: request.getResponseHeader('Range'),
    }))
    request.addEventListener('error', () => reject(createUploadError(
      'Google Driveとの通信が途切れました。',
      { retryable: true },
    )))
    request.addEventListener('timeout', () => reject(createUploadError(
      'Google Driveへの送信がタイムアウトしました。',
      { retryable: true },
    )))
    request.send(body)
  })
}

function driveUploadError(status) {
  if (status === 401 || status === 403) {
    return createUploadError(
      `Google Driveへの書き込みが許可されていません（HTTP ${status}）。再接続してください。`,
      { status },
    )
  }
  return createUploadError(
    `Google Driveへの送信に失敗しました（HTTP ${status || '不明'}）。`,
    { status, retryable: status === 408 || status === 429 || status >= 500 },
  )
}

async function createDriveUploadSession(accessToken, folderId, file) {
  const parameters = new URLSearchParams({
    uploadType: 'resumable',
    fields: FILE_FIELDS,
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

function nextByteFromRange(range, fallback) {
  const matched = range?.match(/bytes=0-(\d+)/)
  return matched ? Number(matched[1]) + 1 : fallback
}

async function queryResumableUpload(uploadUrl, file) {
  const result = await sendUploadRequest({
    method: 'PUT',
    url: uploadUrl,
    headers: { 'Content-Range': `bytes */${file.size}` },
    body: null,
  })
  if (result.status >= 200 && result.status < 300) {
    return { completed: parseDriveFile(result.responseText, file.name) }
  }
  if (result.status === 308) {
    return { offset: nextByteFromRange(result.range, 0) }
  }
  if (result.status === 404) return { expired: true }
  throw driveUploadError(result.status)
}

async function uploadFileResumable(accessToken, folderId, file, onProgress) {
  let uploadUrl = await createDriveUploadSession(accessToken, folderId, file)
  let offset = 0
  let attempt = 0
  const mimeType = file.type || 'application/octet-stream'

  while (offset < file.size) {
    const endExclusive = Math.min(offset + RESUMABLE_CHUNK_SIZE, file.size)
    const chunk = file.slice(offset, endExclusive, mimeType)
    try {
      const result = await sendUploadRequest({
        method: 'PUT',
        url: uploadUrl,
        headers: {
          'Content-Type': mimeType,
          'Content-Range': `bytes ${offset}-${endExclusive - 1}/${file.size}`,
        },
        body: chunk,
        onProgress: (loaded) => onProgress(Math.round(((offset + loaded) / file.size) * 100)),
      })
      if (result.status >= 200 && result.status < 300) {
        return parseDriveFile(result.responseText, file.name)
      }
      if (result.status === 308) {
        offset = nextByteFromRange(result.range, endExclusive)
        attempt = 0
        continue
      }
      if (result.status === 404 && attempt < MAX_UPLOAD_ATTEMPTS - 1) {
        uploadUrl = await createDriveUploadSession(accessToken, folderId, file)
        offset = 0
        attempt += 1
        continue
      }
      throw driveUploadError(result.status)
    } catch (error) {
      if (!error.retryable || attempt === MAX_UPLOAD_ATTEMPTS - 1) throw error
      attempt += 1
      await wait(500 * (2 ** (attempt - 1)))
      try {
        const status = await queryResumableUpload(uploadUrl, file)
        if (status.completed) return status.completed
        if (status.expired) {
          uploadUrl = await createDriveUploadSession(accessToken, folderId, file)
          offset = 0
        } else {
          offset = status.offset
          onProgress(Math.round((offset / file.size) * 100))
        }
      } catch (statusError) {
        if (!statusError.retryable || attempt === MAX_UPLOAD_ATTEMPTS - 1) throw statusError
      }
    }
  }
  throw new Error('Google Driveへの送信を完了できませんでした。')
}

export async function uploadFileDirectlyToDrive(accessToken, folderId, file, onProgress) {
  return uploadFileResumable(accessToken, folderId, file, onProgress)
}
