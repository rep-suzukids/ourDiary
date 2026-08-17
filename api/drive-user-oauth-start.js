import { AuthorizationError, authorizeFamilyRequest } from './_lib/authorization.js'
import { getDatabase } from './_lib/db.js'
import {
  buildDriveAuthorizationUrl,
  createInvitationToken,
  hashInvitationValue,
} from './_lib/google-drive.js'

function safeReturnPath(value) {
  return value === '/album/upload' ? value : '/album'
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'Method not allowed' })
    return
  }
  const url = new URL(request.url, 'http://localhost')
  const familyId = request.query?.familyId ?? url.searchParams.get('familyId')
  if (!familyId) {
    response.status(400).json({ error: 'Family ID is required' })
    return
  }

  try {
    const authorization = await authorizeFamilyRequest(request, familyId)
    const state = createInvitationToken()
    const returnPath = safeReturnPath(request.query?.returnTo ?? url.searchParams.get('returnTo'))
    const sql = getDatabase()
    await sql`
      DELETE FROM google_drive_user_oauth_states
      WHERE expires_at <= now()
         OR (family_id = ${familyId} AND user_id = ${authorization.userId})
    `
    await sql`
      INSERT INTO google_drive_user_oauth_states (
        family_id, user_id, state_hash, return_path, expires_at
      ) VALUES (
        ${familyId}, ${authorization.userId}, ${hashInvitationValue(state)},
        ${returnPath}, now() + interval '10 minutes'
      )
    `
    response.statusCode = 302
    response.setHeader('Location', buildDriveAuthorizationUrl(state))
    response.setHeader('Cache-Control', 'no-store')
    response.end()
  } catch (error) {
    if (error instanceof AuthorizationError) {
      response.status(error.status).json({ error: error.message })
      return
    }
    console.error('Google Drive user OAuth start failed', error)
    response.status(500).json({ error: 'Google Drive連携を開始できませんでした。' })
  }
}
