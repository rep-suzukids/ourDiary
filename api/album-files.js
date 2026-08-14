import { AuthorizationError, authorizeFamilyRequest } from './_lib/authorization.js'
import {
  ensureDriveFolderPermission,
  GoogleDriveConfigurationError,
  GoogleDriveNotConnectedError,
  GoogleDriveRequestError,
  listGoogleDrivePhotos,
} from './_lib/google-drive.js'

function sendJson(response, status, body) {
  response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }
  const familyId = request.headers['x-family-id']
  if (!familyId) {
    sendJson(response, 400, { error: 'Family ID is required' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId)
    await ensureDriveFolderPermission(
      familyId,
      authorization.googleUser.email,
      authorization.role,
    )
    const album = await listGoogleDrivePhotos(familyId)
    response.setHeader('Cache-Control', 'private, max-age=60')
    sendJson(response, 200, album)
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    if (error instanceof GoogleDriveNotConnectedError) {
      sendJson(response, error.status, { error: error.message, code: 'ALBUM_NOT_CONNECTED' })
      return
    }
    if (error instanceof GoogleDriveConfigurationError) {
      console.error('Google Drive configuration failed', error)
      sendJson(response, 503, { error: 'Google Driveの接続設定が完了していません。' })
      return
    }
    if (error instanceof GoogleDriveRequestError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Drive album list failed', error)
    sendJson(response, 502, { error: 'アルバムを読み込めませんでした。' })
  }
}
