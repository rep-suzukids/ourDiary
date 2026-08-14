import { getDatabase } from './_lib/db.js'
import {
  createGoogleDriveFolder,
  encryptRefreshToken,
  ensureDriveFolderPermission,
  exchangeDriveAuthorizationCode,
  getApplicationBaseUrl,
  hashInvitationValue,
} from './_lib/google-drive.js'

function redirectResult(request, response, status) {
  response.statusCode = 302
  response.setHeader(
    'Location',
    `${getApplicationBaseUrl(request)}/drive-owner-connect/complete?status=${encodeURIComponent(status)}`,
  )
  response.setHeader('Cache-Control', 'no-store')
  response.end()
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  const url = new URL(request.url, 'http://localhost')
  const code = request.query?.code ?? url.searchParams.get('code')
  const state = request.query?.state ?? url.searchParams.get('state')
  if (!code || !state) {
    redirectResult(request, response, 'invalid_request')
    return
  }

  try {
    const sql = getDatabase()
    const invitations = await sql`
      SELECT id, family_id, invited_email, album_title, invited_by
      FROM album_owner_invitations
      WHERE oauth_state_hash = ${hashInvitationValue(state)}
        AND accepted_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `
    if (invitations.length === 0) {
      redirectResult(request, response, 'expired')
      return
    }

    const invitation = invitations[0]
    const authorization = await exchangeDriveAuthorizationCode(code)
    if (authorization.email !== invitation.invited_email.toLowerCase()) {
      redirectResult(request, response, 'email_mismatch')
      return
    }

    const existingAlbums = await sql`
      SELECT id FROM drive_albums WHERE family_id = ${invitation.family_id} LIMIT 1
    `
    if (existingAlbums.length > 0) {
      redirectResult(request, response, 'already_connected')
      return
    }

    const folder = await createGoogleDriveFolder(authorization.accessToken, invitation.album_title)
    const encryptedToken = encryptRefreshToken(authorization.refreshToken)
    const connections = await sql`
      INSERT INTO google_drive_connections (
        family_id,
        owner_google_subject,
        owner_email,
        encrypted_refresh_token,
        refresh_token_iv,
        refresh_token_auth_tag
      ) VALUES (
        ${invitation.family_id},
        ${authorization.subject},
        ${authorization.email},
        ${encryptedToken.encryptedRefreshToken},
        ${encryptedToken.refreshTokenIv},
        ${encryptedToken.refreshTokenAuthTag}
      )
      RETURNING id
    `
    await sql`
      INSERT INTO drive_albums (
        family_id, connection_id, google_drive_folder_id, title, created_by
      ) VALUES (
        ${invitation.family_id}, ${connections[0].id}, ${folder.id},
        ${invitation.album_title}, ${invitation.invited_by}
      )
    `

    const members = await sql`
      SELECT u.email, m.role
      FROM family_memberships m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.family_id = ${invitation.family_id}
        AND m.status = 'active'
        AND u.is_active = true
    `
    for (const member of members) {
      try {
        await ensureDriveFolderPermission(invitation.family_id, member.email, member.role)
      } catch (permissionError) {
        console.error('Initial Drive folder sharing failed', member.email, permissionError)
      }
    }

    await sql`
      UPDATE album_owner_invitations
      SET accepted_at = now(), oauth_state_hash = NULL
      WHERE id = ${invitation.id}
    `
    redirectResult(request, response, 'success')
  } catch (error) {
    console.error('Google Drive OAuth callback failed', error)
    redirectResult(request, response, 'failed')
  }
}
