import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import {
  ensureDriveFolderPermission,
  GoogleDriveConfigurationError,
  GoogleDriveNotConnectedError,
  GoogleDriveRequestError,
} from '../_lib/google-drive.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  const familyId = request.headers['x-family-id']
  if (!familyId) {
    response.status(400).json({ error: 'Family ID is required' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId)
    // All family members share the folder owner's Drive access token. Under the
    // drive.file scope a token can only read files the app created for that same
    // account, so unifying on the owner (who created every album file) lets every
    // member view and add photos without per-user consent or cross-user 404s.
    const access = await ensureDriveFolderPermission(
      familyId,
      authorization.googleUser.email,
      authorization.role,
    )
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json({
      accessToken: access.token,
      expiresAt: access.expiresAt,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    if (error instanceof GoogleDriveNotConnectedError) {
      response.status(error.status).json({
        error: error.message,
        code: 'ALBUM_NOT_CONNECTED',
      })
      return
    }
    if (error instanceof GoogleDriveConfigurationError) {
      console.error('Google Drive configuration failed', error)
      response.status(503).json({ error: 'Google Driveの接続設定が完了していません。' })
      return
    }
    if (error instanceof GoogleDriveRequestError) {
      response.status(error.status).json({
        error: error.status === 401
          ? 'Google Driveへの接続を更新できませんでした。アルバム作成者（オーナー）による再接続が必要です。'
          : error.message,
      })
      return
    }
    console.error('Drive access token failed', error)
    response.status(502).json({ error: 'Google Driveへ接続できませんでした。' })
  }
}
