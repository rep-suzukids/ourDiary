import { getDatabase } from './_lib/db.js'
import { hashInvitationValue } from './_lib/google-drive.js'

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
    const rows = await sql`
      SELECT i.invited_email, i.album_title, i.expires_at, f.name AS family_name
      FROM album_owner_invitations i
      INNER JOIN families f ON f.id = i.family_id
      WHERE i.token_hash = ${hashInvitationValue(token)}
        AND i.accepted_at IS NULL
        AND i.expires_at > now()
      LIMIT 1
    `
    if (rows.length === 0) {
      response.status(404).json({ error: 'この招待URLは無効または期限切れです。' })
      return
    }
    response.status(200).json({
      email: rows[0].invited_email,
      albumTitle: rows[0].album_title,
      familyName: rows[0].family_name,
      expiresAt: rows[0].expires_at,
    })
  } catch (error) {
    console.error('Drive owner invitation lookup failed', error)
    response.status(500).json({ error: '招待情報を読み込めませんでした。' })
  }
}
