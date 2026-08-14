const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const DRIVE_READ_SCOPES = `openid email ${DRIVE_FILE_SCOPE}`
export const DRIVE_WRITE_SCOPES = `openid email ${DRIVE_FILE_SCOPE}`

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error ?? 'アルバムを読み込めませんでした。')
    error.code = body.code
    throw error
  }
  return body
}

export async function getAlbumPhotos(credential, familyId) {
  const response = await fetch('/api/album-files', {
    headers: { Authorization: `Bearer ${credential}`, 'x-family-id': familyId },
  })
  return readApiResponse(response)
}

export async function getDrivePhotoUrl(accessToken, photo, signal) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.id)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    },
  )
  if (!response.ok) {
    throw new Error(response.status === 401
      ? 'Google Driveへの接続期限が切れました。'
      : '写真を読み込めませんでした。')
  }
  return URL.createObjectURL(await response.blob())
}

export async function createDriveOwnerInvitation(credential, familyId, values) {
  const response = await fetch('/api/drive-owner-invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credential}`,
      'Content-Type': 'application/json',
      'x-family-id': familyId,
    },
    body: JSON.stringify(values),
  })
  return readApiResponse(response)
}

export async function getDriveOwnerInvitation(token) {
  const response = await fetch(`/api/drive-owner-invitation?${new URLSearchParams({ token })}`)
  return readApiResponse(response)
}

export function saveDriveAccessToken(kind, email, tokenResponse) {
  const expiresIn = Number(tokenResponse.expires_in ?? 3600)
  sessionStorage.setItem(`ourdiary-drive-${kind}`, JSON.stringify({
    accessToken: tokenResponse.access_token,
    email: email.toLowerCase(),
    expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000,
  }))
}

export function loadDriveAccessToken(kind, email) {
  const stored = sessionStorage.getItem(`ourdiary-drive-${kind}`)
  if (!stored) return ''
  try {
    const value = JSON.parse(stored)
    if (!value.accessToken || value.email !== email.toLowerCase() || value.expiresAt <= Date.now()) {
      sessionStorage.removeItem(`ourdiary-drive-${kind}`)
      return ''
    }
    return value.accessToken
  } catch {
    sessionStorage.removeItem(`ourdiary-drive-${kind}`)
    return ''
  }
}

export async function verifyDriveAccount(accessToken, expectedEmail) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Googleアカウントを確認できませんでした。')
  const user = await response.json()
  if (user.email?.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error(`${expectedEmail}のGoogleアカウントを選択してください。`)
  }
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
