import { AuthorizationError, authorizeFamilyRequest } from './_lib/authorization.js'
import { getDatabase } from './_lib/db.js'
import {
  createInvitationToken,
  getApplicationBaseUrl,
  hashInvitationValue,
} from './_lib/google-drive.js'

const INVITATION_LIFETIME_HOURS = 24

function sendJson(response, status, body) {
  response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const familyId = request.headers['x-family-id']
  const email = request.body?.email?.trim().toLowerCase()
  const title = request.body?.title?.trim()
  if (!familyId || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    sendJson(response, 400, { error: '正しいGoogleアカウントのメールアドレスを入力してください。' })
    return
  }
  if (!title || title.length > 500) {
    sendJson(response, 400, { error: 'フォルダ名を1〜500文字で入力してください。' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId, 'album:manage')
    const sql = getDatabase()
    const existingAlbums = await sql`SELECT id FROM drive_albums WHERE family_id = ${familyId} LIMIT 1`
    if (existingAlbums.length > 0) {
      sendJson(response, 409, { error: 'この家族のGoogle Driveアルバムは作成済みです。' })
      return
    }

    const token = createInvitationToken()
    await sql`
      INSERT INTO album_owner_invitations (
        family_id, invited_email, album_title, token_hash, invited_by, expires_at
      ) VALUES (
        ${familyId}, ${email}, ${title}, ${hashInvitationValue(token)}, ${authorization.userId},
        now() + (${INVITATION_LIFETIME_HOURS} * interval '1 hour')
      )
    `

    sendJson(response, 201, {
      invitationUrl: `${getApplicationBaseUrl(request)}/drive-owner-connect?token=${encodeURIComponent(token)}`,
      expiresInHours: INVITATION_LIFETIME_HOURS,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    console.error('Drive owner invitation failed', error)
    sendJson(response, 500, { error: '招待URLを発行できませんでした。' })
  }
}
