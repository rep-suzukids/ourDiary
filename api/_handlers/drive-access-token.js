import { AuthorizationError, authorizeFamilyRequest } from '../_lib/authorization.js'
import {
  getFamilyDriveReadAccess,
  getFamilyDriveOwnerEmail,
  getUserDriveUploadAccess,
  GoogleDriveConfigurationError,
  GoogleDriveNotConnectedError,
  GoogleDriveRequestError,
  GoogleDriveServiceAccountAccessError,
  GoogleDriveUserNotConnectedError,
} from '../_lib/google-drive.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  const familyId = request.headers['x-family-id']
  const url = new URL(request.url, 'http://localhost')
  const purpose = request.query?.purpose ?? url.searchParams.get('purpose') ?? 'read'
  if (!familyId) {
    response.status(400).json({ error: 'Family ID is required' })
    return
  }
  if (!['read', 'upload'].includes(purpose)) {
    response.status(400).json({ error: 'Google Driveの利用目的が正しくありません。' })
    return
  }

  let authorization
  try {
    authorization = await authorizeFamilyRequest(
      request,
      familyId,
      purpose === 'upload' ? 'album:upload' : undefined,
    )
    const access = purpose === 'upload'
      ? await getUserDriveUploadAccess(familyId, authorization.userId)
      : await getFamilyDriveReadAccess(familyId)
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json({
      accessToken: access.token,
      expiresAt: access.expiresAt,
      credentialSource: purpose === 'read' ? 'service-account' : 'user-oauth',
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
    if (error instanceof GoogleDriveUserNotConnectedError) {
      response.status(error.status).json({
        error: '写真を追加するには、ご自身のGoogle Driveへの接続が必要です。',
        code: 'DRIVE_USER_NOT_CONNECTED',
      })
      return
    }
    if (error instanceof GoogleDriveServiceAccountAccessError) {
      const ownerEmail = await getFamilyDriveOwnerEmail(familyId).catch(() => null)
      const canConfigure = Boolean(
        ownerEmail
        && authorization?.googleUser?.email
        && ownerEmail.toLowerCase() === authorization.googleUser.email.toLowerCase(),
      )
      response.status(error.status).json({
        error: canConfigure
          ? '写真閲覧用アカウントをGoogle Driveフォルダへ接続してください。'
          : `写真閲覧用の設定が必要です。アルバム所有者（${ownerEmail ?? '作成者'}）に設定を依頼してください。`,
        code: 'DRIVE_SERVICE_ACCOUNT_ACCESS_REQUIRED',
        canReconnect: canConfigure,
        ownerEmail,
      })
      return
    }
    if (error instanceof GoogleDriveConfigurationError) {
      console.error('Google Drive service account configuration failed', error.message)
      response.status(503).json({
        error: '写真閲覧用のGoogle Drive設定が完了していません。管理者に確認してください。',
        code: 'DRIVE_SERVICE_ACCOUNT_NOT_CONFIGURED',
      })
      return
    }
    if (error instanceof GoogleDriveRequestError) {
      response.status(error.status).json({
        error: purpose === 'upload' && error.status === 401
          ? 'Google Driveへの接続期限が切れました。再接続してください。'
          : error.message,
        code: purpose === 'upload' && error.status === 401
          ? 'DRIVE_USER_RECONNECT_REQUIRED'
          : undefined,
        canReconnect: purpose === 'upload' && error.status === 401,
      })
      return
    }
    console.error('Drive access token failed', error)
    response.status(502).json({ error: 'Google Driveへ接続できませんでした。' })
  }
}
