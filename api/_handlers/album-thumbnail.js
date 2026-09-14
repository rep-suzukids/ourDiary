import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import { getDatabase } from '../_lib/db.js'
import {
  getGoogleDriveThumbnail,
  GoogleDriveConfigurationError,
  GoogleDriveRequestError,
  GoogleDriveServiceAccountAccessError,
} from '../_lib/google-drive.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store')
  response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  const url = new URL(request.url, 'http://localhost')
  const albumFileId = request.query?.albumFileId ?? url.searchParams.get('albumFileId')
  if (!UUID_PATTERN.test(familyId ?? '') || !UUID_PATTERN.test(albumFileId ?? '')) {
    sendJson(response, 400, { error: '写真の指定が正しくありません。' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId)
    const sql = getDatabase()
    const files = await sql`
      SELECT google_drive_file_id AS "driveFileId"
      FROM drive_album_files
      WHERE id = ${albumFileId}
        AND family_id = ${familyId}
        AND (${authorization.role} <> 'member' OR is_published = true)
      LIMIT 1
    `
    if (files.length === 0) {
      sendJson(response, 404, { error: '写真が見つかりませんでした。' })
      return
    }

    const thumbnail = await getGoogleDriveThumbnail(familyId, files[0].driveFileId)
    response.setHeader('Cache-Control', 'private, max-age=900')
    response.setHeader('Content-Type', thumbnail.contentType)
    response.setHeader('Content-Length', String(thumbnail.data.length))
    response.setHeader('Vary', 'Cookie, x-family-id')
    response.status(200).send(thumbnail.data)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    if (error instanceof GoogleDriveRequestError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    if (error instanceof GoogleDriveServiceAccountAccessError || error instanceof GoogleDriveConfigurationError) {
      sendJson(response, 503, { error: '写真閲覧用のGoogle Drive設定を確認してください。' })
      return
    }
    console.error('Album thumbnail failed', error)
    sendJson(response, 502, { error: 'サムネイルを取得できませんでした。' })
  }
}
