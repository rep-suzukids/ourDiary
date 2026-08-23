import { getDatabase } from '../_lib/db.js'
import {
  buildDriveAuthorizationUrl,
  createInvitationToken,
  hashInvitationValue,
} from '../_lib/google-drive.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  const url = new URL(request.url, 'http://localhost')
  const token = request.query?.token ?? url.searchParams.get('token')
  if (!token) {
    response.status(400).json({ error: '招待URLが正しくありません。' })
    return
  }

  try {
    const sql = getDatabase()
    const invitations = await sql`
      SELECT id
      FROM album_owner_invitations
      WHERE token_hash = ${hashInvitationValue(token)}
        AND accepted_at IS NULL
        AND expires_at > now()
      LIMIT 1
    `
    if (invitations.length === 0) {
      response.status(404).json({ error: 'この招待URLは無効または期限切れです。' })
      return
    }

    const state = createInvitationToken()
    await sql`
      UPDATE album_owner_invitations
      SET oauth_state_hash = ${hashInvitationValue(state)}
      WHERE id = ${invitations[0].id}
    `
    response.statusCode = 302
    response.setHeader('Location', buildDriveAuthorizationUrl(state))
    response.setHeader('Cache-Control', 'no-store')
    response.end()
  } catch (error) {
    console.error('Google Drive OAuth start failed', error)
    response.status(500).json({ error: 'Google Drive連携を開始できませんでした。' })
  }
}
