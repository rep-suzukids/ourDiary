import { AuthorizationError, authorizeFamilyRequest } from './_lib/authorization.js'
import {
  ensureDriveFolderPermission,
  getUserDriveAccess,
  GoogleDriveConfigurationError,
  GoogleDriveRequestError,
  GoogleDriveUserNotConnectedError,
} from './_lib/google-drive.js'

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
    await ensureDriveFolderPermission(
      familyId,
      authorization.googleUser.email,
      authorization.role,
    )
    const access = await getUserDriveAccess(
      familyId,
      authorization.userId,
      authorization.googleUser.email,
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
    if (error instanceof GoogleDriveUserNotConnectedError) {
      response.status(error.status).json({
        error: error.message,
        code: 'DRIVE_USER_NOT_CONNECTED',
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
          ? 'Google Driveへの接続を更新できませんでした。再接続してください。'
          : error.message,
        code: error.status === 401 ? 'DRIVE_USER_NOT_CONNECTED' : undefined,
      })
      return
    }
    console.error('Drive access token failed', error)
    response.status(502).json({ error: 'Google Driveへ接続できませんでした。' })
  }
}
