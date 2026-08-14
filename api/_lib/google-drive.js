import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { getDatabase } from './db.js'

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DRIVE_SCOPES = ['openid', 'email', DRIVE_FILE_SCOPE]

export class GoogleDriveConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'GoogleDriveConfigurationError'
  }
}

export class GoogleDriveRequestError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'GoogleDriveRequestError'
    this.status = status
  }
}

export class GoogleDriveNotConnectedError extends Error {
  constructor() {
    super('Google Driveアルバムがまだ作成されていません。')
    this.name = 'GoogleDriveNotConnectedError'
    this.status = 404
  }
}

function requireEnvironment(name) {
  const value = process.env[name]
  if (!value) throw new GoogleDriveConfigurationError(`${name} is not configured`)
  return value
}

function getEncryptionKey() {
  const encodedKey = requireEnvironment('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY')
  const key = Buffer.from(encodedKey, 'base64')
  if (key.length !== 32) {
    throw new GoogleDriveConfigurationError('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must be 32 bytes in base64')
  }
  return key
}

function createOAuthClient() {
  return new OAuth2Client(
    requireEnvironment('GOOGLE_CLIENT_ID'),
    requireEnvironment('GOOGLE_CLIENT_SECRET'),
    requireEnvironment('GOOGLE_DRIVE_REDIRECT_URI'),
  )
}

export function hashInvitationValue(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function createInvitationToken() {
  return randomBytes(32).toString('base64url')
}

export function buildDriveAuthorizationUrl(state) {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: DRIVE_SCOPES,
    state,
  })
}

export async function exchangeDriveAuthorizationCode(code) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.access_token || !tokens.refresh_token || !tokens.id_token) {
    throw new GoogleDriveRequestError('Google Driveの継続利用に必要な認証情報を取得できませんでした。', 400)
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: requireEnvironment('GOOGLE_CLIENT_ID'),
  })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email || payload.email_verified === false) {
    throw new GoogleDriveRequestError('Googleアカウントを確認できませんでした。', 400)
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    subject: payload.sub,
    email: payload.email.toLowerCase(),
  }
}

export function encryptRefreshToken(refreshToken) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()])
  return {
    encryptedRefreshToken: encrypted.toString('base64'),
    refreshTokenIv: iv.toString('base64'),
    refreshTokenAuthTag: cipher.getAuthTag().toString('base64'),
  }
}

function decryptRefreshToken(connection) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(connection.refresh_token_iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(connection.refresh_token_auth_tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(connection.encrypted_refresh_token, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

async function driveFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('Google Drive request failed', response.status, detail)
    throw new GoogleDriveRequestError(
      'Google Driveとの通信に失敗しました。',
      response.status === 401 || response.status === 403 ? 401 : 502,
    )
  }
  return response
}

export async function createGoogleDriveFolder(accessToken, title) {
  const response = await driveFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: title,
        mimeType: 'application/vnd.google-apps.folder',
        appProperties: { ourDiaryAlbum: 'true' },
      }),
    },
  )
  return response.json()
}

async function getFamilyDriveAccess(familyId) {
  const sql = getDatabase()
  const rows = await sql`
    SELECT
      c.owner_email,
      c.encrypted_refresh_token,
      c.refresh_token_iv,
      c.refresh_token_auth_tag,
      a.google_drive_folder_id,
      a.title
    FROM google_drive_connections c
    INNER JOIN drive_albums a ON a.connection_id = c.id
    WHERE c.family_id = ${familyId}
    LIMIT 1
  `
  if (rows.length === 0) throw new GoogleDriveNotConnectedError()

  const oauthClient = createOAuthClient()
  oauthClient.setCredentials({ refresh_token: decryptRefreshToken(rows[0]) })
  const accessToken = await oauthClient.getAccessToken()
  const token = typeof accessToken === 'string' ? accessToken : accessToken?.token
  if (!token) throw new GoogleDriveRequestError('Google Driveの認証を更新できませんでした。', 401)

  return {
    token,
    folderId: rows[0].google_drive_folder_id,
    ownerEmail: rows[0].owner_email,
    title: rows[0].title,
  }
}

export async function ensureDriveFolderPermission(familyId, email, role) {
  const access = await getFamilyDriveAccess(familyId)
  if (access.ownerEmail.toLowerCase() === email.toLowerCase()) return access

  const desiredRole = role === 'member' ? 'reader' : 'writer'
  const fields = encodeURIComponent('permissions(id,emailAddress,role,type)')
  const permissionsResponse = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(access.folderId)}/permissions?fields=${fields}`,
    access.token,
  )
  const permissions = (await permissionsResponse.json()).permissions ?? []
  const existing = permissions.find((permission) => (
    permission.type === 'user'
    && permission.emailAddress?.toLowerCase() === email.toLowerCase()
  ))

  if (!existing) {
    await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(access.folderId)}/permissions?sendNotificationEmail=false`,
      access.token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', role: desiredRole, emailAddress: email }),
      },
    )
  } else if (existing.role !== desiredRole) {
    await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(access.folderId)}/permissions/${encodeURIComponent(existing.id)}`,
      access.token,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: desiredRole }),
      },
    )
  }

  return access
}

export async function listGoogleDrivePhotos(familyId) {
  const access = await getFamilyDriveAccess(familyId)
  const photos = []
  let pageToken = ''
  const query = `'${access.folderId.replaceAll("'", "\\'")}' in parents and trashed = false`

  do {
    const parameters = new URLSearchParams({
      q: query,
      pageSize: '1000',
      orderBy: 'createdTime desc',
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,size,imageMediaMetadata(width,height,rotation))',
      ...(pageToken && { pageToken }),
    })
    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?${parameters}`,
      access.token,
    )
    const page = await response.json()
    for (const item of page.files ?? []) {
      if (!item.mimeType?.startsWith('image/')) continue
      photos.push({
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        createdTime: item.createdTime ?? null,
        size: item.size ? Number(item.size) : null,
        width: item.imageMediaMetadata?.width ?? null,
        height: item.imageMediaMetadata?.height ?? null,
      })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)

  return { title: access.title, folderId: access.folderId, photos }
}

export function getApplicationBaseUrl(request) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  const protocol = request.headers['x-forwarded-proto'] ?? 'http'
  return `${protocol}://${request.headers.host}`
}
