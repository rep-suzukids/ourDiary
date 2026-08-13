import { verifyGoogleCredential } from './_lib/auth.js'
import { getDatabase } from './_lib/db.js'
import { permissionsFor } from './_lib/permissions.js'

function sendJson(response, status, body) {
  response.status(status).json(body)
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  const credential = request.body?.credential

  if (typeof credential !== 'string' || credential.length === 0) {
    sendJson(response, 400, { error: 'Google credential is required' })
    return
  }

  let googleUser

  try {
    googleUser = await verifyGoogleCredential(credential)
  } catch (error) {
    console.error('Google authentication failed', error)
    sendJson(response, 401, { error: 'Google認証に失敗しました。再度ログインしてください。' })
    return
  }

  try {
    const sql = getDatabase()
    const memberships = await sql`
      SELECT
        u.id AS user_id,
        u.email,
        u.display_name,
        u.avatar_url,
        f.id AS family_id,
        f.name AS family_name,
        fm.role
      FROM users u
      INNER JOIN family_memberships fm ON fm.user_id = u.id
      INNER JOIN families f ON f.id = fm.family_id
      WHERE u.is_active = true
        AND fm.status = 'active'
        AND (
          u.google_subject = ${googleUser.subject}
          OR (u.google_subject IS NULL AND u.email = ${googleUser.email})
        )
      ORDER BY fm.created_at ASC
    `

    if (memberships.length === 0) {
      sendJson(response, 403, {
        error: 'このアカウントは招待されていません。管理者に確認してください。',
      })
      return
    }

    const userId = memberships[0].user_id
    const updatedUsers = await sql`
      UPDATE users
      SET
        google_subject = COALESCE(google_subject, ${googleUser.subject}),
        display_name = ${googleUser.name},
        avatar_url = ${googleUser.picture},
        last_login_at = now(),
        updated_at = now()
      WHERE id = ${userId}
        AND (google_subject IS NULL OR google_subject = ${googleUser.subject})
      RETURNING id
    `

    if (updatedUsers.length === 0) {
      sendJson(response, 403, { error: 'Googleアカウントを確認できませんでした。' })
      return
    }

    sendJson(response, 200, {
      user: {
        id: userId,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
      },
      families: memberships.map((membership) => ({
        id: membership.family_id,
        name: membership.family_name,
        role: membership.role,
        permissions: permissionsFor(membership.role),
      })),
    })
  } catch (error) {
    console.error('Database operation failed', error)
    sendJson(response, 503, {
      error: 'データベースに接続できません。しばらくしてから再試行してください。',
    })
  }
}
